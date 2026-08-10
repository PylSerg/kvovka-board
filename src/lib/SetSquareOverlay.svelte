<script>
    import { boardData, bgSettings, deleteSetSquare, toggleFlipXSetSquare, toggleFlipYSetSquare } from "$lib";

    // Track active drag actions
    let activeAction = $state(null); // { type: 'move'|'length'|'rotate'|'scale', setSquareId, ... }

    function getScreenCoords(setSquare) {
        return {
            x: setSquare.x * boardData.zoom + boardData.offsetX,
            y: setSquare.y * boardData.zoom + boardData.offsetY,
        };
    }

    // --- Move Dragging ---
    function startMove(e, setSquare) {
        if (
            e.button !== undefined &&
            e.button !== 0 &&
            e.pointerType === "mouse"
        )
            return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try {
                target.setPointerCapture(pointerId);
            } catch (err) {}
        }

        activeAction = {
            type: "move",
            setSquareId: setSquare.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialX: setSquare.x,
            initialY: setSquare.y,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Resizing Leg Length Dragging ---
    function startResizeLength(e, setSquare) {
        if (
            e.button !== undefined &&
            e.button !== 0 &&
            e.pointerType === "mouse"
        )
            return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try {
                target.setPointerCapture(pointerId);
            } catch (err) {}
        }

        activeAction = {
            type: "length",
            setSquareId: setSquare.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialLegCm: setSquare.legCm,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Rotate Dragging ---
    function startRotate(e, setSquare) {
        if (
            e.button !== undefined &&
            e.button !== 0 &&
            e.pointerType === "mouse"
        )
            return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try {
                target.setPointerCapture(pointerId);
            } catch (err) {}
        }

        const screenPos = getScreenCoords(setSquare);
        const startAngleRad = Math.atan2(
            e.clientY - screenPos.y,
            e.clientX - screenPos.x,
        );

        activeAction = {
            type: "rotate",
            setSquareId: setSquare.id,
            pointerId,
            targetEl: target,
            screenX: screenPos.x,
            screenY: screenPos.y,
            startAngleRad,
            initialAngle: setSquare.angle,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Scale Dragging ---
    function startScale(e, setSquare) {
        if (
            e.button !== undefined &&
            e.button !== 0 &&
            e.pointerType === "mouse"
        )
            return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try {
                target.setPointerCapture(pointerId);
            } catch (err) {}
        }

        activeAction = {
            type: "scale",
            setSquareId: setSquare.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialScaleFactor: setSquare.scaleFactor,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    function handlePointerMove(e) {
        if (!activeAction) return;
        if (
            activeAction.pointerId !== null &&
            e.pointerId !== activeAction.pointerId
        )
            return;

        const sqIndex = boardData.setSquares.findIndex(
            (s) => s.id === activeAction.setSquareId,
        );
        if (sqIndex === -1) return;
        const setSquare = boardData.setSquares[sqIndex];
        const sx = setSquare.flipX ? -1 : 1;
        const sy = setSquare.flipY ? -1 : 1;

        if (activeAction.type === "move") {
            const dx = (e.clientX - activeAction.startX) / boardData.zoom;
            const dy = (e.clientY - activeAction.startY) / boardData.zoom;
            setSquare.x = activeAction.initialX + dx;
            setSquare.y = activeAction.initialY + dy;
        } else if (activeAction.type === "length") {
            const angleRad = (setSquare.angle * Math.PI) / 180;
            const uX = Math.cos(angleRad) * sx;
            const uY = Math.sin(angleRad) * sx;

            const dxScreen = e.clientX - activeAction.startX;
            const dyScreen = e.clientY - activeAction.startY;
            const dxCanvas = dxScreen / boardData.zoom;
            const dyCanvas = dyScreen / boardData.zoom;

            const projPx = dxCanvas * uX + dyCanvas * uY;
            const mmPx = (bgSettings.scale / 5) * setSquare.scaleFactor;
            const cmPx = mmPx * 10;

            const deltaCm = projPx / cmPx;
            let newLeg = activeAction.initialLegCm + deltaCm;
            newLeg = Math.max(
                3,
                Math.min(50, Math.round(newLeg * 2) / 2),
            );
            setSquare.legCm = newLeg;
        } else if (activeAction.type === "rotate") {
            const currentAngleRad = Math.atan2(
                e.clientY - activeAction.screenY,
                e.clientX - activeAction.screenX,
            );
            let deltaDeg =
                (currentAngleRad - activeAction.startAngleRad) *
                (180 / Math.PI);
            let rawAngle = (activeAction.initialAngle + deltaDeg) % 360;
            if (rawAngle < 0) rawAngle += 360;

            // Snap to neat angles if close (within 3.5°)
            const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
            for (const snap of snapAngles) {
                if (Math.abs(rawAngle - snap) < 3.5) {
                    rawAngle = snap % 360;
                    break;
                }
            }
            setSquare.angle = Math.round(rawAngle);
        } else if (activeAction.type === "scale") {
            const angleRad = (setSquare.angle * Math.PI) / 180;
            // Leg 2 unit vector direction in canvas space
            const uX = -Math.sin(angleRad) * sy;
            const uY = Math.cos(angleRad) * sy;

            const dxCanvas = (e.clientX - activeAction.startX) / boardData.zoom;
            const dyCanvas = (e.clientY - activeAction.startY) / boardData.zoom;
            const projPx = dxCanvas * uX + dyCanvas * uY;

            let deltaScale = -projPx / 150;
            let rawScale = activeAction.initialScaleFactor + deltaScale;
            rawScale = Math.max(0.2, Math.min(5.0, rawScale));

            if (Math.abs(rawScale - 1.0) < 0.06) {
                rawScale = 1.0;
            }
            setSquare.scaleFactor = Math.round(rawScale * 100) / 100;
        }

        boardData.setSquares[sqIndex] = setSquare;
    }

    function stopAction(e) {
        if (
            activeAction &&
            activeAction.targetEl &&
            activeAction.targetEl.releasePointerCapture
        ) {
            try {
                activeAction.targetEl.releasePointerCapture(
                    activeAction.pointerId,
                );
            } catch (err) {}
        }
        activeAction = null;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopAction);
        window.removeEventListener("pointercancel", stopAction);
    }
</script>

{#if boardData.setSquares && boardData.setSquares.length > 0}
    <div class="setsquares-layer">
        {#each boardData.setSquares as setSquare (setSquare.id)}
            {@const screenPos = getScreenCoords(setSquare)}
            {@const sx = setSquare.flipX ? -1 : 1}
            {@const sy = setSquare.flipY ? -1 : 1}
            {@const mmPxCanvas = (bgSettings.scale / 5) * setSquare.scaleFactor}
            {@const totalMm = Math.round(setSquare.legCm * 10)}
            {@const legPx = totalMm * mmPxCanvas}
            {@const cutoutInset = Math.max(24, legPx * 0.24)}
            {@const cutoutInnerLen = Math.max(10, legPx - cutoutInset * (1 + Math.SQRT2))}

            <!-- SVG Bounding box offsets -->
            {@const minX = Math.min(0, sx * legPx) - 30}
            {@const minY = Math.min(0, -sy * legPx) - 30}
            {@const width = legPx + 60}
            {@const height = legPx + 60}
            <!-- originX/originY: offset from SVG top-left to the canvas origin (right-angle corner) -->
            {@const originX = -minX}
            {@const originY = -minY}
            {@const centerX = sx * (legPx / 3.4)}
            {@const centerY = -sy * (legPx / 3.4)}

            <!-- SetSquare Container in Screen Space -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="setsquare-container"
                style="
                    left: {screenPos.x}px;
                    top: {screenPos.y}px;
                    transform: rotate({setSquare.angle}deg) scale({boardData.zoom});
                    transform-origin: 0 0;
                "
            >
                <!-- SetSquare Body -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="setsquare-body">
                    <svg
                        class="setsquare-svg"
                        width={width}
                        height={height}
                        viewBox="{minX} {minY} {width} {height}"
                    >
                        <defs>
                            <!-- Glassmorphism fill mask cutout -->
                            <mask id="setsquare-mask-{setSquare.id}">
                                <rect x={minX} y={minY} width={width} height={height} fill="white" />
                                {#if cutoutInnerLen > 5}
                                    <polygon
                                        points="{sx * cutoutInset},{-sy * cutoutInset} {sx * (cutoutInset + cutoutInnerLen)},{-sy * cutoutInset} {sx * cutoutInset},{-sy * (cutoutInset + cutoutInnerLen)}"
                                        fill="black"
                                    />
                                {/if}
                            </mask>
                        </defs>

                        <!-- Triangle acrylic body -->
                        <polygon
                            points="0,0 {sx * legPx},0 0,{-sy * legPx}"
                            fill="rgba(255, 255, 255, 0.28)"
                            mask="url(#setsquare-mask-{setSquare.id})"
                        />

                        <!-- Outer edges -->
                        <polygon
                            points="0,0 {sx * legPx},0 0,{-sy * legPx}"
                            fill="none"
                            stroke="#0f172a"
                            stroke-width="2"
                            stroke-linejoin="round"
                        />

                        <!-- Inner cutout border -->
                        {#if cutoutInnerLen > 5}
                            <polygon
                                points="{sx * cutoutInset},{-sy * cutoutInset} {sx * (cutoutInset + cutoutInnerLen)},{-sy * cutoutInset} {sx * cutoutInset},{-sy * (cutoutInset + cutoutInnerLen)}"
                                fill="none"
                                stroke="#475569"
                                stroke-width="1.5"
                                stroke-linejoin="round"
                            />
                        {/if}

                        <!-- Right angle indicator (90°) at corner (0,0) -->
                        <path
                            d="M 0,{-sy * 14} L {sx * 14},{-sy * 14} L {sx * 14},0"
                            fill="none"
                            stroke="#0f172a"
                            stroke-width="1.5"
                        />
                        <circle cx={sx * 5} cy={-sy * 5} r="1.5" fill="#0f172a" />

                        <!-- Ticks on Leg 1 (Horizontal, Y=0) -->
                        {#each Array(totalMm + 1) as _, i}
                            {@const xPos = i * mmPxCanvas}
                            {@const isCm = i % 10 === 0}
                            {@const is5mm = !isCm && i % 5 === 0}
                            {@const tickLength = isCm ? 18 : is5mm ? 12 : 7}
                            {@const strokeW = isCm ? 1.5 : is5mm ? 1.2 : 0.8}
                            {@const strokeCol = isCm
                                ? "#0f172a"
                                : is5mm
                                  ? "#334155"
                                  : "#64748b"}

                            {#if xPos <= legPx}
                                <line
                                    x1={sx * xPos}
                                    y1="0"
                                    x2={sx * xPos}
                                    y2={-sy * tickLength}
                                    stroke={strokeCol}
                                    stroke-width={strokeW}
                                />

                                {#if isCm && xPos < legPx - 8}
                                    <text
                                        x={sx * xPos}
                                        y={-sy * 24}
                                        font-size="11"
                                        font-weight="600"
                                        font-family="system-ui, -apple-system, sans-serif"
                                        fill="#0f172a"
                                        text-anchor="middle"
                                        dominant-baseline="central"
                                        user-select="none"
                                    >
                                        {i / 10}
                                    </text>
                                {/if}
                            {/if}
                        {/each}

                        <!-- Ticks on Leg 2 (Vertical, X=0) -->
                        {#each Array(totalMm + 1) as _, i}
                            {@const yPos = i * mmPxCanvas}
                            {@const isCm = i % 10 === 0}
                            {@const is5mm = !isCm && i % 5 === 0}
                            {@const tickLength = isCm ? 18 : is5mm ? 12 : 7}
                            {@const strokeW = isCm ? 1.5 : is5mm ? 1.2 : 0.8}
                            {@const strokeCol = isCm
                                ? "#0f172a"
                                : is5mm
                                  ? "#334155"
                                  : "#64748b"}

                            {#if yPos <= legPx}
                                <line
                                    x1="0"
                                    y1={-sy * yPos}
                                    x2={sx * tickLength}
                                    y2={-sy * yPos}
                                    stroke={strokeCol}
                                    stroke-width={strokeW}
                                />

                                {#if isCm && yPos < legPx - 8 && i > 0}
                                    <text
                                        x={sx * 24}
                                        y={-sy * yPos}
                                        font-size="11"
                                        font-weight="600"
                                        font-family="system-ui, -apple-system, sans-serif"
                                        fill="#0f172a"
                                        text-anchor="middle"
                                        dominant-baseline="central"
                                        user-select="none"
                                    >
                                        {i / 10}
                                    </text>
                                {/if}
                            {/if}
                        {/each}
                    </svg>

                    <!-- Control Panel inside Cutout (Center of Mass) -->

                    <!-- 1. Move Handle (Center of Cutout) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="setsquare-handle move-handle"
                        style="left: {centerX + originX}px; top: {centerY + originY}px;"
                        onpointerdown={(e) => startMove(e, setSquare)}
                        title="Затисніть і тягніть для переміщення косинця"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="5 9 2 12 5 15"></polyline>
                            <polyline points="9 5 12 2 15 5"></polyline>
                            <polyline points="15 19 12 22 9 19"></polyline>
                            <polyline points="19 9 22 12 19 15"></polyline>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <line x1="12" y1="2" x2="12" y2="22"></line>
                        </svg>
                    </div>

                    <!-- 2. Delete Handle (In Cutout, Above Move) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="setsquare-handle delete-handle"
                        style="left: {centerX + originX}px; top: {centerY - sy * 30 + originY}px;"
                        onclick={(e) => {
                            e.stopPropagation();
                            deleteSetSquare(setSquare.id);
                        }}
                        onpointerdown={(e) => e.stopPropagation()}
                        title="Видалити косинець"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </div>

                    <!-- 3. Flip Horizontal Handle (Left of Move) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="setsquare-handle flip-handle"
                        style="left: {centerX - sx * 30 + originX}px; top: {centerY + originY}px;"
                        onclick={(e) => {
                            e.stopPropagation();
                            toggleFlipXSetSquare(setSquare.id);
                        }}
                        onpointerdown={(e) => e.stopPropagation()}
                        title="Віддзеркалити по горизонталі (Flip X)"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="17 1 21 5 17 9"></polyline>
                            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                            <polyline points="7 23 3 19 7 15"></polyline>
                            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                        </svg>
                    </div>

                    <!-- 4. Flip Vertical Handle (Right/Down of Move) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="setsquare-handle flip-handle"
                        style="left: {centerX + originX}px; top: {centerY + sy * 30 + originY}px;"
                        onclick={(e) => {
                            e.stopPropagation();
                            toggleFlipYSetSquare(setSquare.id);
                        }}
                        onpointerdown={(e) => e.stopPropagation()}
                        title="Віддзеркалити по вертикалі (Flip Y)"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="1 17 5 21 9 17"></polyline>
                            <path d="M11 3H9a4 4 0 0 0-4 4v14"></path>
                            <polyline points="23 7 19 3 15 7"></polyline>
                            <path d="M13 21h2a4 4 0 0 0 4-4V3"></path>
                        </svg>
                    </div>

                    <!-- 5. Leg 1 Length Handle (Midpoint of Horizontal Leg) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="setsquare-handle length-handle"
                        style="left: {sx * (legPx / 2) + originX}px; top: {sy * 16 + originY}px;"
                        onpointerdown={(e) => startResizeLength(e, setSquare)}
                        title="Затисніть і тягніть для зміни довжини катетів"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </div>

                    <!-- 6. Rotate Drag Handle (Outside Hypotenuse Midpoint) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="setsquare-handle rotate-handle"
                        style="left: {sx * (legPx / 2 + 16) + originX}px; top: {-sy * (legPx / 2 + 16) + originY}px;"
                        onpointerdown={(e) => startRotate(e, setSquare)}
                        title="Затисніть і тягніть для обертання косинця"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path
                                d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"
                            />
                        </svg>
                    </div>

                    <!-- 7. Scale Drag Handle (Midpoint of Vertical Leg) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="setsquare-handle scale-handle"
                        style="left: {-sx * 16 + originX}px; top: {-sy * (legPx / 2) + originY}px;"
                        onpointerdown={(e) => startScale(e, setSquare)}
                        title="Затисніть і тягніть для зміни масштабу поділок"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/if}

<style lang="scss">
    .setsquares-layer {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 950;
        overflow: visible;
    }

    .setsquare-container {
        position: absolute;
        pointer-events: none;
        user-select: none;
        touch-action: none;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        will-change: transform, left, top;
    }

    .setsquare-body {
        position: relative;
        cursor: default;
        filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.09));
        pointer-events: none;
    }

    .setsquare-svg {
        display: block;
        pointer-events: none;
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        overflow: visible;
    }

    .setsquare-handle {
        position: absolute;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        border: 1.5px solid #007bff;
        color: #007bff;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0, 123, 255, 0.25);
        cursor: pointer;
        transition:
            transform 0.15s ease,
            background-color 0.15s ease;
        z-index: 10;
        transform: translate(-50%, -50%);

        &:hover {
            transform: translate(-50%, -50%) scale(1.2);
            background: #007bff;
            color: #ffffff;
        }

        &.delete-handle {
            width: 24px;
            height: 24px;
            border-color: #ef4444;
            color: #ef4444;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);

            &:hover {
                background: #ef4444;
                color: #ffffff;
            }
        }

        &.flip-handle {
            width: 24px;
            height: 24px;
            border-color: #0284c7;
            color: #0284c7;
            box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25);

            &:hover {
                background: #0284c7;
                color: #ffffff;
            }
        }

        &.length-handle {
            width: 22px;
            height: 22px;
            border-radius: 6px;

            &:hover {
                transform: translate(-50%, -50%) scale(1.15);
            }
        }

        &.rotate-handle {
            width: 24px;
            height: 24px;
            border-color: #4f46e5;
            color: #4f46e5;
            box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);

            &:hover {
                background: #4f46e5;
                color: #ffffff;
            }
        }

        &.scale-handle {
            width: 24px;
            height: 24px;
            border-color: #d97706;
            color: #d97706;
            box-shadow: 0 2px 8px rgba(217, 119, 6, 0.25);

            &:hover {
                background: #d97706;
                color: #ffffff;
            }
        }

        &.move-handle {
            width: 26px;
            height: 26px;
            border-color: #16a34a;
            color: #16a34a;
            box-shadow: 0 2px 8px rgba(22, 163, 74, 0.25);
            cursor: grab;

            &:hover {
                background: #16a34a;
                color: #ffffff;
                transform: translate(-50%, -50%) scale(1.15);
            }

            &:active {
                cursor: grabbing;
            }
        }
    }
</style>
