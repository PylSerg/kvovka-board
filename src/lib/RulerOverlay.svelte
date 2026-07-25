<script>
    import { onMount } from "svelte";
    import { boardData, bgSettings, deleteRuler } from "$lib";

    // Track active drag actions
    let activeAction = $state(null); // { type: 'move'|'length'|'rotate'|'scale', rulerId, ... }

    function getScreenCoords(ruler) {
        return {
            x: ruler.x * boardData.zoom + boardData.offsetX,
            y: ruler.y * boardData.zoom + boardData.offsetY,
        };
    }

    // --- Move Dragging ---
    function startMove(e, ruler) {
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
            rulerId: ruler.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialX: ruler.x,
            initialY: ruler.y,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Resizing Length Dragging ---
    function startResizeLength(e, ruler) {
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
            rulerId: ruler.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialLengthCm: ruler.lengthCm,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Rotate Dragging ---
    function startRotate(e, ruler) {
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

        const screenPos = getScreenCoords(ruler);
        const startAngleRad = Math.atan2(
            e.clientY - screenPos.y,
            e.clientX - screenPos.x,
        );

        activeAction = {
            type: "rotate",
            rulerId: ruler.id,
            pointerId,
            targetEl: target,
            screenX: screenPos.x,
            screenY: screenPos.y,
            startAngleRad,
            initialAngle: ruler.angle,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Scale Dragging ---
    function startScale(e, ruler) {
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
            rulerId: ruler.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialScaleFactor: ruler.scaleFactor,
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

        const rulerIndex = boardData.rulers.findIndex(
            (r) => r.id === activeAction.rulerId,
        );
        if (rulerIndex === -1) return;
        const ruler = boardData.rulers[rulerIndex];

        if (activeAction.type === "move") {
            const dx = (e.clientX - activeAction.startX) / boardData.zoom;
            const dy = (e.clientY - activeAction.startY) / boardData.zoom;
            ruler.x = activeAction.initialX + dx;
            ruler.y = activeAction.initialY + dy;
        } else if (activeAction.type === "length") {
            const angleRad = (ruler.angle * Math.PI) / 180;
            const uX = Math.cos(angleRad);
            const uY = Math.sin(angleRad);

            const dxScreen = e.clientX - activeAction.startX;
            const dyScreen = e.clientY - activeAction.startY;
            const dxCanvas = dxScreen / boardData.zoom;
            const dyCanvas = dyScreen / boardData.zoom;

            const projPx = dxCanvas * uX + dyCanvas * uY;
            const mmPx = (bgSettings.scale / 5) * ruler.scaleFactor;
            const cmPx = mmPx * 10;

            const deltaCm = projPx / cmPx;
            let newLength = activeAction.initialLengthCm + deltaCm;
            newLength = Math.max(
                3,
                Math.min(100, Math.round(newLength * 2) / 2),
            );
            ruler.lengthCm = newLength;
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
            ruler.angle = Math.round(rawAngle);
        } else if (activeAction.type === "scale") {
            const angleRad = (ruler.angle * Math.PI) / 180;
            const uX = Math.cos(angleRad);
            const uY = Math.sin(angleRad);

            const dxCanvas = (e.clientX - activeAction.startX) / boardData.zoom;
            const dyCanvas = (e.clientY - activeAction.startY) / boardData.zoom;
            const projPx = dxCanvas * uX + dyCanvas * uY;

            let deltaScale = projPx / 150;
            let rawScale = activeAction.initialScaleFactor + deltaScale;
            rawScale = Math.max(0.2, Math.min(5.0, rawScale));

            // Snap to 1.0 (5mm = 1 cell) if close
            if (Math.abs(rawScale - 1.0) < 0.06) {
                rawScale = 1.0;
            }
            ruler.scaleFactor = Math.round(rawScale * 100) / 100;
        }

        boardData.rulers[rulerIndex] = ruler;
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

{#if boardData.rulers && boardData.rulers.length > 0}
    <div class="rulers-layer">
        {#each boardData.rulers as ruler (ruler.id)}
            {@const screenPos = getScreenCoords(ruler)}
            {@const mmPxCanvas = (bgSettings.scale / 5) * ruler.scaleFactor}
            {@const totalMm = Math.round(ruler.lengthCm * 10)}
            {@const rulerWidthCanvas = totalMm * mmPxCanvas}
            {@const rulerHeightCanvas = 60}

            <!-- Ruler Container in Screen Space with CSS Transform -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="ruler-container"
                style="
                    left: {screenPos.x}px;
                    top: {screenPos.y}px;
                    transform: rotate({ruler.angle}deg) scale({boardData.zoom});
                    transform-origin: 0 0;
                "
            >
                <!-- Ruler Body -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="ruler-body"
                    style="width: {rulerWidthCanvas}px; height: {rulerHeightCanvas}px;"
                >
                    <!-- SVG Ticks & Number Labels -->
                    <svg
                        class="ruler-svg"
                        width={rulerWidthCanvas}
                        height={rulerHeightCanvas}
                    >
                        <!-- Top guide edge line -->
                        <line
                            x1="0"
                            y1="0"
                            x2={rulerWidthCanvas}
                            y2="0"
                            stroke="#0f172a"
                            stroke-width="2"
                        />

                        {#each Array(totalMm + 1) as _, i}
                            {@const xPos = i * mmPxCanvas}
                            {@const isCm = i % 10 === 0}
                            {@const is5mm = !isCm && i % 5 === 0}
                            {@const tickLength = isCm ? 22 : is5mm ? 14 : 9}
                            {@const strokeW = isCm ? 1.5 : is5mm ? 1.2 : 0.8}
                            {@const strokeCol = isCm
                                ? "#0f172a"
                                : is5mm
                                  ? "#334155"
                                  : "#64748b"}

                            <line
                                x1={xPos}
                                y1="0"
                                x2={xPos}
                                y2={tickLength}
                                stroke={strokeCol}
                                stroke-width={strokeW}
                            />

                            {#if isCm}
                                <text
                                    x={xPos}
                                    y="36"
                                    font-size="13"
                                    font-weight="600"
                                    font-family="system-ui, -apple-system, sans-serif"
                                    fill="#0f172a"
                                    text-anchor="middle"
                                    user-select="none"
                                >
                                    {i / 10}
                                </text>
                            {/if}
                        {/each}
                    </svg>

                    <!-- Delete Handle (Bottom-Left Knob) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="ruler-handle delete-handle"
                        style="left: -14px; top: {rulerHeightCanvas + 4}px;"
                        onclick={(e) => {
                            e.stopPropagation();
                            deleteRuler(ruler.id);
                        }}
                        onpointerdown={(e) => e.stopPropagation()}
                        title="Видалити лінійку"
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

                    <!-- Move Handle (Bottom-Center) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="ruler-handle move-handle"
                        style="left: {rulerWidthCanvas / 2}px; top: {rulerHeightCanvas + 4}px;"
                        onpointerdown={(e) => startMove(e, ruler)}
                        title="Затисніть і тягніть для переміщення лінійки"
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

                    <!-- 1. Length Handle (Right Edge) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="ruler-handle length-handle"
                        style="left: {rulerWidthCanvas}px;"
                        onpointerdown={(e) => startResizeLength(e, ruler)}
                        title="Затисніть і тягніть для зміни довжини лінійки"
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

                    <!-- 2. Rotate Drag Handle (Top-Right Knob) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="ruler-handle rotate-handle"
                        style="left: {rulerWidthCanvas + 14}px; top: -14px;"
                        onpointerdown={(e) => startRotate(e, ruler)}
                        title="Затисніть і тягніть для обертання лінійки"
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

                    <!-- 3. Scale Drag Handle (Bottom-Right Knob) -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="ruler-handle scale-handle"
                        style="left: {rulerWidthCanvas +
                            14}px; top: {rulerHeightCanvas + 4}px;"
                        onpointerdown={(e) => startScale(e, ruler)}
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
    .rulers-layer {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 950;
        overflow: visible;
    }

    .ruler-container {
        position: absolute;
        pointer-events: auto;
        user-select: none;
        touch-action: none;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        will-change: transform, left, top;
    }

    .ruler-body {
        position: relative;
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        border: 1px solid rgba(15, 23, 42, 0.18);
        border-top: 2px solid #0f172a;
        border-radius: 4px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
        cursor: default;
    }

    .ruler-svg {
        display: block;
        pointer-events: none;
    }

    .ruler-handle {
        position: absolute;
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

        &:hover {
            transform: scale(1.2);
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
                transform: scale(1.2);
            }
        }

        &.length-handle {
            top: 50%;
            transform: translate(-50%, -50%);
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
            transform: translateX(-50%);
            cursor: grab;

            &:hover {
                background: #16a34a;
                color: #ffffff;
                transform: translateX(-50%) scale(1.15);
            }

            &:active {
                cursor: grabbing;
            }
        }
    }
</style>
