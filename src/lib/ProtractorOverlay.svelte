<script>
    import { boardData, bgSettings, deleteProtractor, toggleFlipYProtractor } from "$lib";

    // Track active drag actions
    let activeAction = $state(null); // { type: 'move'|'radius'|'rotate'|'scale', protractorId, ... }

    function getScreenCoords(protractor) {
        return {
            x: protractor.x * boardData.zoom + boardData.offsetX,
            y: protractor.y * boardData.zoom + boardData.offsetY,
        };
    }

    // --- Move Dragging ---
    function startMove(e, protractor) {
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
            protractorId: protractor.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialX: protractor.x,
            initialY: protractor.y,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Resizing Radius Dragging ---
    function startResizeRadius(e, protractor) {
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
            type: "radius",
            protractorId: protractor.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialRadiusCm: protractor.radiusCm,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Rotate Dragging ---
    function startRotate(e, protractor) {
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

        const screenPos = getScreenCoords(protractor);
        const startAngleRad = Math.atan2(
            e.clientY - screenPos.y,
            e.clientX - screenPos.x,
        );

        activeAction = {
            type: "rotate",
            protractorId: protractor.id,
            pointerId,
            targetEl: target,
            screenX: screenPos.x,
            screenY: screenPos.y,
            startAngleRad,
            initialAngle: protractor.angle,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Scale Dragging ---
    function startScale(e, protractor) {
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
            protractorId: protractor.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialScaleFactor: protractor.scaleFactor,
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

        const pIndex = boardData.protractors.findIndex(
            (p) => p.id === activeAction.protractorId,
        );
        if (pIndex === -1) return;
        const protractor = boardData.protractors[pIndex];

        if (activeAction.type === "move") {
            const dx = (e.clientX - activeAction.startX) / boardData.zoom;
            const dy = (e.clientY - activeAction.startY) / boardData.zoom;
            protractor.x = activeAction.initialX + dx;
            protractor.y = activeAction.initialY + dy;
        } else if (activeAction.type === "radius") {
            const angleRad = (protractor.angle * Math.PI) / 180;
            const uX = Math.cos(angleRad);
            const uY = Math.sin(angleRad);

            const dxScreen = e.clientX - activeAction.startX;
            const dyScreen = e.clientY - activeAction.startY;
            const dxCanvas = dxScreen / boardData.zoom;
            const dyCanvas = dyScreen / boardData.zoom;

            const projPx = dxCanvas * uX + dyCanvas * uY;
            const mmPx = (bgSettings.scale / 5) * protractor.scaleFactor;
            const cmPx = mmPx * 10;

            const deltaCm = projPx / cmPx;
            let newRadius = activeAction.initialRadiusCm + deltaCm;
            newRadius = Math.max(
                3,
                Math.min(30, Math.round(newRadius * 2) / 2),
            );
            protractor.radiusCm = newRadius;
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
            protractor.angle = Math.round(rawAngle);
        } else if (activeAction.type === "scale") {
            const angleRad = (protractor.angle * Math.PI) / 180;
            const uX = Math.cos(angleRad);
            const uY = Math.sin(angleRad);

            const dxCanvas = (e.clientX - activeAction.startX) / boardData.zoom;
            const dyCanvas = (e.clientY - activeAction.startY) / boardData.zoom;
            const projPx = dxCanvas * uX + dyCanvas * uY;

            let deltaScale = projPx / 150;
            let rawScale = activeAction.initialScaleFactor + deltaScale;
            rawScale = Math.max(0.2, Math.min(5.0, rawScale));

            if (Math.abs(rawScale - 1.0) < 0.06) {
                rawScale = 1.0;
            }
            protractor.scaleFactor = Math.round(rawScale * 100) / 100;
        }

        boardData.protractors[pIndex] = protractor;
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

{#if boardData.protractors && boardData.protractors.length > 0}
    <div class="protractors-layer">
        {#each boardData.protractors as protractor (protractor.id)}
            {@const screenPos = getScreenCoords(protractor)}
            {@const sy = protractor.flipY ? -1 : 1}
            {@const mmPxCanvas = (bgSettings.scale / 5) * protractor.scaleFactor}
            {@const totalMm = Math.round(protractor.radiusCm * 10)}
            {@const radiusPx = totalMm * mmPxCanvas}
            {@const cutoutRadius = Math.max(28, radiusPx * 0.42)}

            <!-- SVG Bounding box offsets relative to center vertex (0,0) -->
            {@const minX = -radiusPx - 30}
            {@const minY = sy === 1 ? -radiusPx - 35 : -25}
            {@const width = 2 * radiusPx + 60}
            {@const height = radiusPx + 60}

            <!-- Protractor Container in Screen Space -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="protractor-container"
                style="
                    left: {screenPos.x}px;
                    top: {screenPos.y}px;
                    transform: rotate({protractor.angle}deg) scale({boardData.zoom});
                    transform-origin: 0 0;
                "
            >
                <!-- Protractor Body -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="protractor-body">
                    <svg
                        class="protractor-svg"
                        width={width}
                        height={height}
                        viewBox="{minX} {minY} {width} {height}"
                        style="position: absolute; left: {minX}px; top: {minY}px;"
                    >
                        <defs>
                            <!-- Glassmorphism fill mask cutout -->
                            <mask id="protractor-mask-{protractor.id}">
                                <rect x={minX} y={minY} width={width} height={height} fill="white" />
                                {#if cutoutRadius > 10}
                                    <path
                                        d="M {-cutoutRadius} 0 A {cutoutRadius} {cutoutRadius} 0 0 {sy === 1 ? 1 : 0} {cutoutRadius} 0 Z"
                                        fill="black"
                                    />
                                {/if}
                            </mask>
                        </defs>

                        <!-- Semi-circle acrylic body -->
                        <path
                            d="M {-radiusPx} 0 A {radiusPx} {radiusPx} 0 0 {sy === 1 ? 1 : 0} {radiusPx} 0 Z"
                            fill="rgba(255, 255, 255, 0.28)"
                            mask="url(#protractor-mask-{protractor.id})"
                        />

                        <!-- Outer arc & baseline border -->
                        <path
                            d="M {-radiusPx} 0 A {radiusPx} {radiusPx} 0 0 {sy === 1 ? 1 : 0} {radiusPx} 0 Z"
                            fill="none"
                            stroke="#0f172a"
                            stroke-width="2"
                            stroke-linejoin="round"
                        />

                        <!-- Inner cutout arc border -->
                        {#if cutoutRadius > 10}
                            <path
                                d="M {-cutoutRadius} 0 A {cutoutRadius} {cutoutRadius} 0 0 {sy === 1 ? 1 : 0} {cutoutRadius} 0 Z"
                                fill="none"
                                stroke="#475569"
                                stroke-width="1.5"
                                stroke-linejoin="round"
                            />
                        {/if}

                        <!-- Vertex origin crosshair at (0,0) -->
                        <line x1="-10" y1="0" x2="10" y2="0" stroke="#0f172a" stroke-width="1.5" />
                        <line x1="0" y1={-sy * 12} x2="0" y2="0" stroke="#0f172a" stroke-width="1.5" />
                        <circle cx="0" cy="0" r="2" fill="#0f172a" />

                        <!-- Degree Ticks & Numbers (0° to 180°) -->
                        {#each Array(181) as _, deg}
                            {@const is10 = deg % 10 === 0}
                            {@const is5 = !is10 && deg % 5 === 0}

                            {#if is10 || is5 || radiusPx > 90}
                                {@const rad = (deg * Math.PI) / 180}
                                {@const cosA = Math.cos(rad)}
                                {@const sinA = Math.sin(rad)}
                                {@const tickLen = is10 ? 16 : is5 ? 11 : 6}
                                {@const strokeW = is10 ? 1.5 : is5 ? 1.2 : 0.8}
                                {@const strokeCol = is10 ? "#0f172a" : is5 ? "#334155" : "#64748b"}

                                {@const xOuter = cosA * radiusPx}
                                {@const yOuter = -sy * sinA * radiusPx}
                                {@const xInner = cosA * (radiusPx - tickLen)}
                                {@const yInner = -sy * sinA * (radiusPx - tickLen)}

                                <line
                                    x1={xOuter}
                                    y1={yOuter}
                                    x2={xInner}
                                    y2={yInner}
                                    stroke={strokeCol}
                                    stroke-width={strokeW}
                                />

                                {#if is10}
                                    {@const xOuterNum = cosA * (radiusPx - 26)}
                                    {@const yOuterNum = -sy * sinA * (radiusPx - 26)}
                                    <text
                                        x={xOuterNum}
                                        y={yOuterNum}
                                        font-size="10"
                                        font-weight="700"
                                        font-family="system-ui, -apple-system, sans-serif"
                                        fill="#0f172a"
                                        text-anchor="middle"
                                        dominant-baseline="central"
                                        user-select="none"
                                    >
                                        {deg}
                                    </text>

                                    {@const xInnerNum = cosA * (radiusPx - 38)}
                                    {@const yInnerNum = -sy * sinA * (radiusPx - 38)}
                                    {#if radiusPx > 110}
                                        <text
                                            x={xInnerNum}
                                            y={yInnerNum}
                                            font-size="8.5"
                                            font-weight="600"
                                            font-family="system-ui, -apple-system, sans-serif"
                                            fill="#475569"
                                            text-anchor="middle"
                                            dominant-baseline="central"
                                            user-select="none"
                                        >
                                            {180 - deg}
                                        </text>
                                    {/if}
                                {/if}
                            {/if}
                        {/each}
                    </svg>

                    <!-- Control Panel (Positioned relative to origin (0,0)) -->

                    <!-- 1. Move Handle (Center of Cutout) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="protractor-handle move-handle"
                        style="left: 0px; top: {-sy * (cutoutRadius * 0.45)}px;"
                        onpointerdown={(e) => startMove(e, protractor)}
                        title="Затисніть і тягніть для переміщення транспортира"
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

                    <!-- 2. Delete Handle (Above Move) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="protractor-handle delete-handle"
                        style="left: 0px; top: {-sy * (cutoutRadius * 0.85)}px;"
                        onclick={(e) => {
                            e.stopPropagation();
                            deleteProtractor(protractor.id);
                        }}
                        onpointerdown={(e) => e.stopPropagation()}
                        title="Видалити транспортир"
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

                    <!-- 3. Flip Vertical Handle (Left of Move inside cutout) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="protractor-handle flip-handle"
                        style="left: {-cutoutRadius * 0.55}px; top: {-sy * (cutoutRadius * 0.45)}px;"
                        onclick={(e) => {
                            e.stopPropagation();
                            toggleFlipYProtractor(protractor.id);
                        }}
                        onpointerdown={(e) => e.stopPropagation()}
                        title="Віддзеркалити транспортир (Flip Y)"
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

                    <!-- 4. Radius Length Handle (Right of Move inside cutout) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="protractor-handle radius-handle"
                        style="left: {cutoutRadius * 0.55}px; top: {-sy * (cutoutRadius * 0.45)}px;"
                        onpointerdown={(e) => startResizeRadius(e, protractor)}
                        title="Затисніть і тягніть для зміни радіуса транспортира"
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

                    <!-- 5. Rotate Handle (Above 90° Top Arc Apex) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="protractor-handle rotate-handle"
                        style="left: 0px; top: {-sy * (radiusPx + 18)}px;"
                        onpointerdown={(e) => startRotate(e, protractor)}
                        title="Затисніть і тягніть для обертання транспортира"
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

                    <!-- 6. Scale Handle (At Right Baseline Edge) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="protractor-handle scale-handle"
                        style="left: {radiusPx + 18}px; top: 0px;"
                        onpointerdown={(e) => startScale(e, protractor)}
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
    .protractors-layer {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 950;
        overflow: visible;
    }

    .protractor-container {
        position: absolute;
        pointer-events: none;
        user-select: none;
        touch-action: none;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        will-change: transform, left, top;
    }

    .protractor-body {
        position: relative;
        cursor: default;
        filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.09));
        pointer-events: none;
    }

    .protractor-svg {
        display: block;
        pointer-events: none;
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        overflow: visible;
    }

    .protractor-handle {
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

        &.radius-handle {
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
