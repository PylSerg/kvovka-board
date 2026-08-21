<script>
    import { boardData, bgSettings, brushSettings, deleteCoordLine } from "$lib";
    import { saveState } from "$lib/history.svelte.js";

    // Track active drag actions: 'move' | 'rotate' | 'scale' | 'minLimit' | 'maxLimit'
    let activeAction = $state(null);

    function getScreenCoords(line) {
        return {
            x: line.x * boardData.zoom + boardData.offsetX,
            y: line.y * boardData.zoom + boardData.offsetY,
        };
    }

    // --- Move Dragging ---
    function startMove(e, line) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try { target.setPointerCapture(pointerId); } catch (err) {}
        }

        activeAction = {
            type: "move",
            lineId: line.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialX: line.x,
            initialY: line.y,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Rotate Dragging ---
    function startRotate(e, line) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try { target.setPointerCapture(pointerId); } catch (err) {}
        }

        const screenPos = getScreenCoords(line);
        const startAngleRad = Math.atan2(e.clientY - screenPos.y, e.clientX - screenPos.x);

        activeAction = {
            type: "rotate",
            lineId: line.id,
            pointerId,
            targetEl: target,
            screenX: screenPos.x,
            screenY: screenPos.y,
            startAngleRad,
            initialAngle: line.angle || 0,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Scale Dragging ---
    function startScale(e, line) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try { target.setPointerCapture(pointerId); } catch (err) {}
        }

        activeAction = {
            type: "scale",
            lineId: line.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialScaleFactor: line.scaleFactor || 1.0,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Min Limit Dragging (Left end) ---
    function startMinLimit(e, line) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try { target.setPointerCapture(pointerId); } catch (err) {}
        }

        activeAction = {
            type: "minLimit",
            lineId: line.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialMinVal: line.minVal ?? -5,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Max Limit Dragging (Right end) ---
    function startMaxLimit(e, line) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try { target.setPointerCapture(pointerId); } catch (err) {}
        }

        activeAction = {
            type: "maxLimit",
            lineId: line.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialMaxVal: line.maxVal ?? 5,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    function handlePointerMove(e) {
        if (!activeAction) return;
        if (activeAction.pointerId !== null && e.pointerId !== activeAction.pointerId) return;

        const lineIndex = (boardData.coordLines || []).findIndex(l => l.id === activeAction.lineId);
        if (lineIndex === -1) return;
        const line = boardData.coordLines[lineIndex];

        const step = (line.stepPx || 40) * (line.scaleFactor || 1.0);
        const rad = ((line.angle || 0) * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        if (activeAction.type === "move") {
            const dx = (e.clientX - activeAction.startX) / boardData.zoom;
            const dy = (e.clientY - activeAction.startY) / boardData.zoom;
            line.x = activeAction.initialX + dx;
            line.y = activeAction.initialY + dy;
        } else if (activeAction.type === "rotate") {
            const currentAngleRad = Math.atan2(e.clientY - activeAction.screenY, e.clientX - activeAction.screenX);
            let deltaDeg = (currentAngleRad - activeAction.startAngleRad) * (180 / Math.PI);
            let rawAngle = (activeAction.initialAngle + deltaDeg) % 360;
            if (rawAngle < 0) rawAngle += 360;

            const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
            for (const snap of snapAngles) {
                if (Math.abs(rawAngle - snap) < 3.5) {
                    rawAngle = snap % 360;
                    break;
                }
            }
            line.angle = Math.round(rawAngle);
        } else if (activeAction.type === "scale") {
            const dx = (e.clientX - activeAction.startX) / boardData.zoom;
            const dy = (e.clientY - activeAction.startY) / boardData.zoom;
            const projPx = dx * cosA + dy * sinA;
            let rawScale = activeAction.initialScaleFactor + projPx / 120;
            rawScale = Math.max(0.3, Math.min(3.0, rawScale));
            if (Math.abs(rawScale - 1.0) < 0.05) rawScale = 1.0;
            line.scaleFactor = Math.round(rawScale * 100) / 100;
        } else if (activeAction.type === "minLimit") {
            const dx = (e.clientX - activeAction.startX) / boardData.zoom;
            const dy = (e.clientY - activeAction.startY) / boardData.zoom;
            const projPx = dx * cosA + dy * sinA;
            const deltaUnits = Math.round(projPx / step);
            let newMin = activeAction.initialMinVal + deltaUnits;
            newMin = Math.min(line.maxVal - 1, Math.max(-25, newMin));
            line.minVal = newMin;
        } else if (activeAction.type === "maxLimit") {
            const dx = (e.clientX - activeAction.startX) / boardData.zoom;
            const dy = (e.clientY - activeAction.startY) / boardData.zoom;
            const projPx = dx * cosA + dy * sinA;
            const deltaUnits = Math.round(projPx / step);
            let newMax = activeAction.initialMaxVal + deltaUnits;
            newMax = Math.max(line.minVal + 1, Math.min(25, newMax));
            line.maxVal = newMax;
        }

        boardData.coordLines[lineIndex] = line;
    }

    function stopAction() {
        if (activeAction && activeAction.targetEl && activeAction.targetEl.releasePointerCapture) {
            try { activeAction.targetEl.releasePointerCapture(activeAction.pointerId); } catch (err) {}
        }
        activeAction = null;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopAction);
        window.removeEventListener("pointercancel", stopAction);
    }

    function toggleNumbers(line) {
        line.showNumbers = !line.showNumbers;
        boardData.coordLines = [...boardData.coordLines];
    }

    function stampToCanvas(line) {
        saveState();
        const step = (line.stepPx || 40) * (line.scaleFactor || 1.0);
        const rad = ((line.angle || 0) * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        const minVal = line.minVal ?? -5;
        const maxVal = line.maxVal ?? 5;

        const leftX = (minVal - 0.5) * step;
        const rightX = (maxVal + 0.8) * step;

        const pStart = {
            x: line.x + leftX * cosA,
            y: line.y + leftX * sinA
        };
        const pEnd = {
            x: line.x + rightX * cosA,
            y: line.y + rightX * sinA
        };

        const newLines = [];

        // 1. Головна вісь
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2,
            points: [pStart, pEnd]
        });

        // 2. Стрілка
        const arrowLen = 14;
        const arrowAngle = Math.PI / 7;
        const a1 = {
            x: pEnd.x - arrowLen * Math.cos(rad - arrowAngle),
            y: pEnd.y - arrowLen * Math.sin(rad - arrowAngle)
        };
        const a2 = {
            x: pEnd.x - arrowLen * Math.cos(rad + arrowAngle),
            y: pEnd.y - arrowLen * Math.sin(rad + arrowAngle)
        };
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2,
            points: [a1, pEnd, a2]
        });

        // 3. Поділки
        for (let v = minVal; v <= maxVal; v++) {
            const vx = v * step;
            const tickH = v === 0 ? 12 : 7;
            const tTop = {
                x: line.x + vx * cosA - tickH * (-sinA),
                y: line.y + vx * sinA - tickH * cosA
            };
            const tBottom = {
                x: line.x + vx * cosA + tickH * (-sinA),
                y: line.y + vx * sinA + tickH * cosA
            };
            newLines.push({
                id: Date.now() + Math.random(),
                color: brushSettings.color || "#0f172a",
                width: v === 0 ? 2 : 1.5,
                points: [tTop, tBottom]
            });

            // 4. Текстові підписи
            if (line.showNumbers) {
                const textPos = {
                    x: line.x + vx * cosA + 18 * (-sinA) - 5,
                    y: line.y + vx * sinA + 18 * cosA
                };
                newLines.push({
                    id: Date.now() + Math.random(),
                    tool: "text",
                    text: String(v),
                    fontSize: 14,
                    color: brushSettings.color || "#0f172a",
                    points: [textPos]
                });
            }
        }

        // Підпис осі 'x'
        const labelPos = {
            x: line.x + (rightX + 5) * cosA - 5 * (-sinA),
            y: line.y + (rightX + 5) * sinA - 5 * cosA
        };
        newLines.push({
            id: Date.now() + Math.random(),
            tool: "text",
            text: line.axisLabel || "x",
            fontSize: 16,
            color: brushSettings.color || "#0f172a",
            points: [labelPos]
        });

        boardData.lines = [...boardData.lines, ...newLines];
    }
</script>

{#if boardData.coordLines && boardData.coordLines.length > 0}
    <div class="coord-lines-layer">
        {#each boardData.coordLines as line (line.id)}
            {@const screenPos = getScreenCoords(line)}
            {@const step = (line.stepPx || 40) * (line.scaleFactor || 1.0)}
            {@const minVal = line.minVal ?? -5}
            {@const maxVal = line.maxVal ?? 5}
            {@const leftPx = (minVal - 0.6) * step}
            {@const rightPx = (maxVal + 0.9) * step}
            {@const totalLengthPx = rightPx - leftPx}

            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="coord-line-container"
                style="
                    left: {screenPos.x}px;
                    top: {screenPos.y}px;
                    transform: rotate({line.angle || 0}deg) scale({boardData.zoom});
                    transform-origin: 0 0;
                "
            >
                <!-- SVG Rendering -->
                <svg
                    class="coord-line-svg"
                    style="overflow: visible;"
                >
                    <!-- Головна вісь -->
                    <line
                        x1={leftPx}
                        y1="0"
                        x2={rightPx}
                        y2="0"
                        stroke="#1e293b"
                        stroke-width="2.2"
                    />

                    <!-- Стрілка на додатньому кінці -->
                    <polygon
                        points="{rightPx},0 {rightPx - 12},-5 {rightPx - 8},0 {rightPx - 12},5"
                        fill="#1e293b"
                    />

                    <!-- Підпис осі 'x' -->
                    <text
                        x={rightPx + 6}
                        y="-4"
                        font-size="16"
                        font-weight="bold"
                        font-style="italic"
                        font-family="system-ui, -apple-system, sans-serif"
                        fill="#0f172a"
                        user-select="none"
                    >
                        {line.axisLabel || 'x'}
                    </text>

                    <!-- Поділки та числа -->
                    {#each Array(maxVal - minVal + 1) as _, i}
                        {@const v = minVal + i}
                        {@const xPos = v * step}
                        {@const isZero = v === 0}
                        {@const tickH = isZero ? 13 : 8}

                        <line
                            x1={xPos}
                            y1={-tickH}
                            x2={xPos}
                            y2={tickH}
                            stroke={isZero ? "#0f172a" : "#334155"}
                            stroke-width={isZero ? "2.5" : "1.5"}
                        />

                        {#if line.showNumbers}
                            <text
                                x={xPos}
                                y="24"
                                font-size={isZero ? "14" : "13"}
                                font-weight={isZero ? "bold" : "500"}
                                font-family="system-ui, -apple-system, sans-serif"
                                fill={isZero ? "#0f172a" : "#475569"}
                                text-anchor="middle"
                                user-select="none"
                            >
                                {v}
                            </text>
                        {/if}
                    {/each}
                </svg>

                <!-- Контроли та ручки -->
                <!-- 1. Move Handle (Центр на початку відліку 0) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle move-handle"
                    style="left: 0px; top: -28px;"
                    onpointerdown={(e) => startMove(e, line)}
                    title="Затисніть і тягніть для переміщення прямої"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="5 9 2 12 5 15"></polyline>
                        <polyline points="9 5 12 2 15 5"></polyline>
                        <polyline points="15 19 12 22 9 19"></polyline>
                        <polyline points="19 9 22 12 19 15"></polyline>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <line x1="12" y1="2" x2="12" y2="22"></line>
                    </svg>
                </div>

                <!-- 2. Rotate Handle (Біля правого краю) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle rotate-handle"
                    style="left: {rightPx + 16}px; top: -28px;"
                    onpointerdown={(e) => startRotate(e, line)}
                    title="Обертати координатну пряму"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                </div>

                <!-- 3. Scale Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle scale-handle"
                    style="left: {rightPx + 16}px; top: 22px;"
                    onpointerdown={(e) => startScale(e, line)}
                    title="Масштабувати крок поділок"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                </div>

                <!-- 4. Min Limit Handle (Зліва) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle limit-handle"
                    style="left: {minVal * step}px; top: 0px;"
                    onpointerdown={(e) => startMinLimit(e, line)}
                    title="Змінити ліву межу ({minVal})"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </div>

                <!-- 5. Max Limit Handle (Справа) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle limit-handle"
                    style="left: {maxVal * step}px; top: 0px;"
                    onpointerdown={(e) => startMaxLimit(e, line)}
                    title="Змінити праву межу ({maxVal})"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

                <!-- 6. Toggle Numbers Button -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle toggle-handle"
                    class:active={line.showNumbers}
                    style="left: -32px; top: -28px;"
                    onclick={(e) => { e.stopPropagation(); toggleNumbers(line); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title={line.showNumbers ? "Сховати числа" : "Показати числа"}
                >
                    <span style="font-size: 11px; font-weight: bold;">123</span>
                </div>

                <!-- 7. Stamp Button (Намалювати на полотні) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle stamp-handle"
                    style="left: -60px; top: -28px;"
                    onclick={(e) => { e.stopPropagation(); stampToCanvas(line); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title="Закарбувати на дошці як малюнок"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </div>

                <!-- 8. Delete Button (Видалити) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle delete-handle"
                    style="left: {leftPx - 16}px; top: 0px;"
                    onclick={(e) => { e.stopPropagation(); deleteCoordLine(line.id); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title="Видалити координатну пряму"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </div>
            </div>
        {/each}
    </div>
{/if}

<style>
    .coord-lines-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 15;
    }

    .coord-line-container {
        position: absolute;
        pointer-events: none;
        will-change: transform, left, top;
    }

    .coord-line-svg {
        display: block;
        pointer-events: none;
        filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.08));
    }

    .tool-handle {
        position: absolute;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        border: 1.5px solid #0284c7;
        color: #0284c7;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25);
        cursor: pointer;
        transition: transform 0.15s ease, background-color 0.15s ease, color 0.15s ease;
        z-index: 20;
        transform: translate(-50%, -50%);
        user-select: none;

        &:hover {
            transform: translate(-50%, -50%) scale(1.18);
            background: #0284c7;
            color: #ffffff;
        }

        &.move-handle {
            width: 24px;
            height: 24px;
            border-color: #16a34a;
            color: #16a34a;
            box-shadow: 0 2px 8px rgba(22, 163, 74, 0.25);
            cursor: grab;

            &:hover {
                background: #16a34a;
                color: #ffffff;
            }
            &:active {
                cursor: grabbing;
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

        &.limit-handle {
            width: 20px;
            height: 20px;
            border-radius: 5px;
            border-color: #2563eb;
            color: #2563eb;

            &:hover {
                background: #2563eb;
                color: #ffffff;
            }
        }

        &.toggle-handle {
            width: 24px;
            height: 24px;
            border-color: #8b5cf6;
            color: #8b5cf6;
            box-shadow: 0 2px 8px rgba(139, 92, 246, 0.25);

            &.active {
                background: #8b5cf6;
                color: #ffffff;
            }
        }

        &.stamp-handle {
            width: 24px;
            height: 24px;
            border-color: #059669;
            color: #059669;
            box-shadow: 0 2px 8px rgba(5, 150, 105, 0.25);

            &:hover {
                background: #059669;
                color: #ffffff;
            }
        }

        &.delete-handle {
            width: 22px;
            height: 22px;
            border-color: #ef4444;
            color: #ef4444;
            box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);

            &:hover {
                background: #ef4444;
                color: #ffffff;
            }
        }
    }
</style>
