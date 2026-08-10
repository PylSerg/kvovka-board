<script>
    import { boardData, bgSettings, brushSettings, deleteCompass } from "$lib";
    import { saveState } from "$lib/history.svelte.js";

    // Track active drag actions
    // type: 'move' | 'radius' | 'rotate' | 'scale'
    let activeAction = $state(null);
    let arcPoints = $state([]); // Points drawn during live arc rotation

    function getScreenCoords(compass) {
        return {
            x: compass.x * boardData.zoom + boardData.offsetX,
            y: compass.y * boardData.zoom + boardData.offsetY,
        };
    }

    // --- Draw full circle helper ---
    function drawFullCircle(compass) {
        saveState();
        const mmPx = (bgSettings.scale / 5) * compass.scaleFactor;
        const radiusPx = compass.radiusCm * 10 * mmPx;
        const steps = 72; // 5-degree increments for smooth circle
        const points = [];

        for (let i = 0; i <= steps; i++) {
            const rad = (i * (360 / steps) * Math.PI) / 180;
            points.push({
                x: compass.x + radiusPx * Math.cos(rad),
                y: compass.y + radiusPx * Math.sin(rad),
            });
        }

        const newLine = {
            id: Date.now() + Math.random(),
            color: brushSettings.color,
            width: brushSettings.width,
            points,
        };

        boardData.lines = [...boardData.lines, newLine];
    }

    // --- Move Dragging (Drag needle position) ---
    function startMove(e, compass) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse")
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
            compassId: compass.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialX: compass.x,
            initialY: compass.y,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Resizing Radius Dragging ---
    function startResizeRadius(e, compass) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse")
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
            compassId: compass.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialRadiusCm: compass.radiusCm,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Rotate Pencil & Arc Drawing ---
    function startRotate(e, compass, isDrawMode = false) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse")
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

        const screenPos = getScreenCoords(compass);
        const startAngleRad = Math.atan2(
            e.clientY - screenPos.y,
            e.clientX - screenPos.x,
        );

        const mmPx = (bgSettings.scale / 5) * compass.scaleFactor;
        const radiusPx = compass.radiusCm * 10 * mmPx;

        arcPoints = [];
        if (isDrawMode) {
            const initialRad = (compass.angle * Math.PI) / 180;
            arcPoints.push({
                x: compass.x + radiusPx * Math.cos(initialRad),
                y: compass.y + radiusPx * Math.sin(initialRad),
            });
        }

        activeAction = {
            type: "rotate",
            compassId: compass.id,
            pointerId,
            targetEl: target,
            screenX: screenPos.x,
            screenY: screenPos.y,
            startAngleRad,
            initialAngle: compass.angle,
            isDrawMode,
            radiusPx,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Scale Dragging ---
    function startScale(e, compass) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse")
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
            compassId: compass.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialScaleFactor: compass.scaleFactor,
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

        const cIndex = boardData.compasses.findIndex(
            (c) => c.id === activeAction.compassId,
        );
        if (cIndex === -1) return;
        const compass = boardData.compasses[cIndex];

        if (activeAction.type === "move") {
            const dx = (e.clientX - activeAction.startX) / boardData.zoom;
            const dy = (e.clientY - activeAction.startY) / boardData.zoom;
            compass.x = activeAction.initialX + dx;
            compass.y = activeAction.initialY + dy;
        } else if (activeAction.type === "radius") {
            const angleRad = (compass.angle * Math.PI) / 180;
            const uX = Math.cos(angleRad);
            const uY = Math.sin(angleRad);

            const dxCanvas = (e.clientX - activeAction.startX) / boardData.zoom;
            const dyCanvas = (e.clientY - activeAction.startY) / boardData.zoom;

            const projPx = dxCanvas * uX + dyCanvas * uY;
            const mmPx = (bgSettings.scale / 5) * compass.scaleFactor;
            const cmPx = mmPx * 10;

            const deltaCm = projPx / cmPx;
            let newRadius = activeAction.initialRadiusCm + deltaCm;
            newRadius = Math.max(
                1,
                Math.min(35, Math.round(newRadius * 10) / 10),
            );
            compass.radiusCm = newRadius;
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

            // Snap angle if not drawing
            if (!activeAction.isDrawMode) {
                const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
                for (const snap of snapAngles) {
                    if (Math.abs(rawAngle - snap) < 3.5) {
                        rawAngle = snap % 360;
                        break;
                    }
                }
            }

            compass.angle = Math.round(rawAngle);

            if (activeAction.isDrawMode) {
                const curRad = (compass.angle * Math.PI) / 180;
                const newPt = {
                    x: compass.x + activeAction.radiusPx * Math.cos(curRad),
                    y: compass.y + activeAction.radiusPx * Math.sin(curRad),
                };
                // Avoid tiny duplicate points
                const lastPt = arcPoints[arcPoints.length - 1];
                if (
                    !lastPt ||
                    Math.hypot(newPt.x - lastPt.x, newPt.y - lastPt.y) > 2
                ) {
                    arcPoints = [...arcPoints, newPt];
                }
            }
        } else if (activeAction.type === "scale") {
            const angleRad = (compass.angle * Math.PI) / 180;
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
            compass.scaleFactor = Math.round(rawScale * 100) / 100;
        }

        boardData.compasses[cIndex] = compass;
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

        if (activeAction && activeAction.isDrawMode && arcPoints.length > 2) {
            saveState();
            const newLine = {
                id: Date.now() + Math.random(),
                color: brushSettings.color,
                width: brushSettings.width,
                points: arcPoints,
            };
            boardData.lines = [...boardData.lines, newLine];
        }

        arcPoints = [];
        activeAction = null;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopAction);
        window.removeEventListener("pointercancel", stopAction);
    }
</script>

{#if boardData.compasses && boardData.compasses.length > 0}
    <div class="compasses-layer">
        {#each boardData.compasses as compass (compass.id)}
            {@const screenPos = getScreenCoords(compass)}
            {@const mmPxCanvas = (bgSettings.scale / 5) * compass.scaleFactor}
            {@const totalMm = Math.round(compass.radiusCm * 10)}
            {@const radiusPx = totalMm * mmPxCanvas}
            {@const angleRad = (compass.angle * Math.PI) / 180}

            <!-- Pencil Tip relative offset from needle (0,0) in local rotated space -->
            {@const pencilX = radiusPx}
            {@const pencilY = 0}

            <!-- Top Joint Hinge calculations (apex of compass triangle) -->
            {@const hingeDist = Math.max(65, radiusPx * 0.75)}
            {@const hingeX = radiusPx / 2}
            {@const hingeY = -hingeDist}
            {@const barY = hingeY * 0.45}
            {@const barLeftX = hingeX * 0.45}
            {@const barRightX = hingeX + (radiusPx - hingeX) * 0.55}

            <!-- SVG bounding box sizes -->
            {@const minX = -40}
            {@const minY = -hingeDist - 55}
            {@const maxX = Math.max(radiusPx + 40, 100)}
            {@const maxY = 45}
            {@const svgWidth = maxX - minX}
            {@const svgHeight = maxY - minY}

            <!-- Compass Container in Screen Space -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="compass-container"
                style="
                    left: {screenPos.x}px;
                    top: {screenPos.y}px;
                    transform: rotate({compass.angle}deg) scale({boardData.zoom});
                    transform-origin: 0 0;
                "
            >
                <div class="compass-body">
                    <svg
                        class="compass-svg"
                        width={svgWidth}
                        height={svgHeight}
                        viewBox="{minX} {minY} {svgWidth} {svgHeight}"
                        style="position: absolute; left: {minX}px; top: {minY}px;"
                    >
                        <defs>
                            <!-- Leg gradient -->
                            <linearGradient id="leg-grad-{compass.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#475569" />
                                <stop offset="50%" stop-color="#1e293b" />
                                <stop offset="100%" stop-color="#0f172a" />
                            </linearGradient>
                            <linearGradient id="pencil-grad-{compass.id}" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stop-color="#3b82f6" />
                                <stop offset="100%" stop-color="#1d4ed8" />
                            </linearGradient>
                        </defs>

                        <!-- Guideline Circle arc preview (ghost circle) -->
                        <circle
                            cx="0"
                            cy="0"
                            r={radiusPx}
                            fill="none"
                            stroke="#007bff"
                            stroke-width="1.2"
                            stroke-dasharray="4 4"
                            opacity="0.5"
                        />

                        <!-- Live drawn arc preview stroke -->
                        {#if activeAction && activeAction.compassId === compass.id && arcPoints.length > 1}
                            {@const pathData = arcPoints.map((pt, idx) => {
                                // Convert canvas points to local SVG coords relative to (compass.x, compass.y) and rotated -angle
                                const dx = pt.x - compass.x;
                                const dy = pt.y - compass.y;
                                const lx = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
                                const ly = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);
                                return `${idx === 0 ? 'M' : 'L'} ${lx} ${ly}`;
                            }).join(' ')}
                            <path
                                d={pathData}
                                fill="none"
                                stroke={brushSettings.color}
                                stroke-width={brushSettings.width}
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        {/if}

                        <!-- Center crosshair / Needle Target at (0,0) -->
                        <circle cx="0" cy="0" r="16" fill="rgba(239, 68, 68, 0.08)" stroke="#ef4444" stroke-width="1" stroke-dasharray="2 2" />
                        <line x1="-10" y1="0" x2="10" y2="0" stroke="#ef4444" stroke-width="1.5" />
                        <line x1="0" y1="-10" x2="0" y2="10" stroke="#ef4444" stroke-width="1.5" />
                        <circle cx="0" cy="0" r="3" fill="#ef4444" />

                        <!-- Needle Leg (Top Hinge to Needle Point (0,0)) -->
                        <path
                            d="M {hingeX - 3} {hingeY + 10} L -2 -14 L 0 0 L 2 -14 L {hingeX + 1} {hingeY + 10} Z"
                            fill="url(#leg-grad-{compass.id})"
                            stroke="#0f172a"
                            stroke-width="1"
                        />
                        <!-- Silver needle tip -->
                        <polygon points="-1,-14 1,-14 0,0" fill="#cbd5e1" stroke="#475569" stroke-width="0.5" />

                        <!-- Pencil Leg (Top Hinge to Pencil Point (radiusPx, 0)) -->
                        <path
                            d="M {hingeX + 1} {hingeY + 10} L {radiusPx - 3} -16 L {radiusPx} 0 L {radiusPx + 3} -16 L {hingeX + 5} {hingeY + 10} Z"
                            fill="url(#leg-grad-{compass.id})"
                            stroke="#0f172a"
                            stroke-width="1"
                        />

                        <!-- Wooden/Lead Pencil Body at Pencil Tip -->
                        <rect x={radiusPx - 4} y="-22" width="8" height="14" rx="2" fill="url(#pencil-grad-{compass.id})" stroke="#1e3a8a" stroke-width="1" />
                        <polygon points="{radiusPx - 4},-8 {radiusPx + 4},-8 {radiusPx},0" fill="#fde047" stroke="#ca8a04" stroke-width="0.8" />
                        <polygon points="{radiusPx - 1.5},-3 {radiusPx + 1.5},-3 {radiusPx},0" fill={brushSettings.color} />

                        <!-- Top Hinge Joint (Apex Knob) -->
                        <circle cx={hingeX} cy={hingeY} r="12" fill="#334155" stroke="#0f172a" stroke-width="2" />
                        <circle cx={hingeX} cy={hingeY} r="6" fill="#94a3b8" />
                        <!-- Top turn handle peg -->
                        <rect x={hingeX - 3} y={hingeY - 26} width="6" height="14" rx="3" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />

                        <!-- Cross Bar / Radius Indicator Arc -->
                        <path
                            d="M {barLeftX} {barY} Q {hingeX} {barY - 8} {barRightX} {barY}"
                            fill="none"
                            stroke="#64748b"
                            stroke-width="3"
                            stroke-linecap="round"
                        />
                        <rect
                            x={hingeX - 28}
                            y={barY - 22}
                            width="56"
                            height="18"
                            rx="9"
                            fill="#ffffff"
                            stroke="#0284c7"
                            stroke-width="1.5"
                        />
                        <text
                            x={hingeX}
                            y={barY - 10}
                            font-size="10"
                            font-weight="700"
                            font-family="system-ui, -apple-system, sans-serif"
                            fill="#0369a1"
                            text-anchor="middle"
                            dominant-baseline="central"
                        >
                            {compass.radiusCm} см
                        </text>
                    </svg>

                    <!-- Control Handles -->

                    <!-- 1. Move Handle (Positioned at Needle point / Center) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="compass-handle move-handle"
                        style="left: 0px; top: -32px;"
                        onpointerdown={(e) => startMove(e, compass)}
                        title="Затисніть і тягніть для переміщення голки циркуля"
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

                    <!-- 2. Delete Handle (Left of Needle) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="compass-handle delete-handle"
                        style="left: -32px; top: 0px;"
                        onclick={(e) => {
                            e.stopPropagation();
                            deleteCompass(compass.id);
                        }}
                        onpointerdown={(e) => e.stopPropagation()}
                        title="Видалити циркуль"
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

                    <!-- 3. Draw Full Circle Action Button (Above Top Hinge) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="compass-handle circle-handle"
                        style="left: {hingeX}px; top: {hingeY - 42}px;"
                        onclick={(e) => {
                            e.stopPropagation();
                            drawFullCircle(compass);
                        }}
                        onpointerdown={(e) => e.stopPropagation()}
                        title="Намалювати повне коло 360°"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <circle cx="12" cy="12" r="9"></circle>
                        </svg>
                    </div>

                    <!-- 4. Radius Adjustment Handle (At Pencil Leg Slider / Radius Handle) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="compass-handle radius-handle"
                        style="left: {radiusPx / 2}px; top: {hingeY / 2}px;"
                        onpointerdown={(e) => startResizeRadius(e, compass)}
                        title="Затисніть і тягніть для зміни розхилу/радіуса"
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

                    <!-- 5. Rotate & Free Turn Pencil Handle (Above Pencil Tip) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="compass-handle rotate-handle"
                        style="left: {radiusPx}px; top: -32px;"
                        onpointerdown={(e) => startRotate(e, compass, false)}
                        title="Поворот олівця (без малювання)"
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
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                    </div>

                    <!-- 6. Draw Arc Pencil Handle (Above Pencil Tip, below Rotate) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="compass-handle draw-arc-handle"
                        style="left: {radiusPx}px; top: -62px;"
                        onpointerdown={(e) => startRotate(e, compass, true)}
                        title="Затисніть та обертайте для малювання дуги!"
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
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                    </div>

                    <!-- 7. Scale Handle (Below Needle) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="compass-handle scale-handle"
                        style="left: 0px; top: 32px;"
                        onpointerdown={(e) => startScale(e, compass)}
                        title="Затисніть і тягніть для зміни масштабу циркуля"
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
    .compasses-layer {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 950;
        overflow: visible;
    }

    .compass-container {
        position: absolute;
        pointer-events: none;
        user-select: none;
        touch-action: none;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        will-change: transform, left, top;
    }

    .compass-body {
        position: relative;
        cursor: default;
        filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.12));
        pointer-events: none;
    }

    .compass-svg {
        display: block;
        pointer-events: none;
        overflow: visible;
    }

    .compass-handle {
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

        &.circle-handle {
            width: 26px;
            height: 26px;
            border-color: #10b981;
            color: #10b981;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);

            &:hover {
                background: #10b981;
                color: #ffffff;
            }
        }

        &.draw-arc-handle {
            width: 28px;
            height: 28px;
            border-color: #8b5cf6;
            color: #8b5cf6;
            box-shadow: 0 2px 10px rgba(139, 92, 246, 0.35);

            &:hover {
                background: #8b5cf6;
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
