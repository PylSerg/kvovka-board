<script>
    import { boardData, bgSettings, brushSettings, deleteCoordPlane2D } from "$lib";
    import { saveState } from "$lib/history.svelte.js";

    // Track active drag actions: 'move' | 'rotate' | 'scale' | 'resizeXMax' | 'resizeXMin' | 'resizeYMax' | 'resizeYMin'
    let activeAction = $state(null);

    function getScreenCoords(plane) {
        return {
            x: plane.x * boardData.zoom + boardData.offsetX,
            y: plane.y * boardData.zoom + boardData.offsetY,
        };
    }

    // --- Move Dragging ---
    function startMove(e, plane) {
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
            planeId: plane.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialX: plane.x,
            initialY: plane.y,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Rotate Dragging ---
    function startRotate(e, plane) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try { target.setPointerCapture(pointerId); } catch (err) {}
        }

        const screenPos = getScreenCoords(plane);
        const startAngleRad = Math.atan2(e.clientY - screenPos.y, e.clientX - screenPos.x);

        activeAction = {
            type: "rotate",
            planeId: plane.id,
            pointerId,
            targetEl: target,
            screenX: screenPos.x,
            screenY: screenPos.y,
            startAngleRad,
            initialAngle: plane.angle || 0,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Scale Dragging ---
    function startScale(e, plane) {
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
            planeId: plane.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialScaleFactor: plane.scaleFactor || 1.0,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    // --- Resize Handles ---
    function startResize(e, plane, type) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try { target.setPointerCapture(pointerId); } catch (err) {}
        }

        activeAction = {
            type,
            planeId: plane.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialMinX: plane.minX ?? -5,
            initialMaxX: plane.maxX ?? 5,
            initialMinY: plane.minY ?? -5,
            initialMaxY: plane.maxY ?? 5,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    function handlePointerMove(e) {
        if (!activeAction) return;
        if (activeAction.pointerId !== null && e.pointerId !== activeAction.pointerId) return;

        const planeIndex = (boardData.coordPlanes2D || []).findIndex(p => p.id === activeAction.planeId);
        if (planeIndex === -1) return;
        const plane = boardData.coordPlanes2D[planeIndex];

        const step = (plane.stepPx || 40) * (plane.scaleFactor || 1.0);
        const rad = ((plane.angle || 0) * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        const dxCanvas = (e.clientX - activeAction.startX) / boardData.zoom;
        const dyCanvas = (e.clientY - activeAction.startY) / boardData.zoom;

        // Local projection
        const lx = dxCanvas * cosA + dyCanvas * sinA;
        const ly = -dxCanvas * sinA + dyCanvas * cosA;

        if (activeAction.type === "move") {
            plane.x = activeAction.initialX + dxCanvas;
            plane.y = activeAction.initialY + dyCanvas;
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
            plane.angle = Math.round(rawAngle);
        } else if (activeAction.type === "scale") {
            const projPx = (lx - ly) / Math.SQRT2;
            let rawScale = activeAction.initialScaleFactor + projPx / 150;
            rawScale = Math.max(0.3, Math.min(3.0, rawScale));
            if (Math.abs(rawScale - 1.0) < 0.05) rawScale = 1.0;
            plane.scaleFactor = Math.round(rawScale * 100) / 100;
        } else if (activeAction.type === "resizeXMax") {
            const delta = Math.round(lx / step);
            plane.maxX = Math.max(1, Math.min(25, activeAction.initialMaxX + delta));
        } else if (activeAction.type === "resizeXMin") {
            const delta = Math.round(lx / step);
            plane.minX = Math.min(-1, Math.max(-25, activeAction.initialMinX + delta));
        } else if (activeAction.type === "resizeYMax") {
            // Screen Y is inverted (up is negative ly)
            const delta = Math.round(-ly / step);
            plane.maxY = Math.max(1, Math.min(25, activeAction.initialMaxY + delta));
        } else if (activeAction.type === "resizeYMin") {
            const delta = Math.round(-ly / step);
            plane.minY = Math.min(-1, Math.max(-25, activeAction.initialMinY + delta));
        }

        boardData.coordPlanes2D[planeIndex] = plane;
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

    function toggleGrid(plane) {
        plane.showGrid = !plane.showGrid;
        boardData.coordPlanes2D = [...boardData.coordPlanes2D];
    }

    function toggleNumbers(plane) {
        plane.showNumbers = !plane.showNumbers;
        boardData.coordPlanes2D = [...boardData.coordPlanes2D];
    }

    function stampToCanvas(plane) {
        saveState();
        const step = (plane.stepPx || 40) * (plane.scaleFactor || 1.0);
        const rad = ((plane.angle || 0) * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        const minX = plane.minX ?? -5;
        const maxX = plane.maxX ?? 5;
        const minY = plane.minY ?? -5;
        const maxY = plane.maxY ?? 5;

        const toCanvasPt = (lx, ly) => ({
            x: plane.x + lx * cosA - ly * sinA,
            y: plane.y + lx * sinA + ly * cosA
        });

        const newLines = [];

        // 1. Координатна сітка (якщо ввімкнено)
        if (plane.showGrid) {
            for (let x = minX; x <= maxX; x++) {
                if (x === 0) continue;
                const p1 = toCanvasPt(x * step, -maxY * step);
                const p2 = toCanvasPt(x * step, -minY * step);
                newLines.push({
                    id: Date.now() + Math.random(),
                    color: "rgba(148, 163, 184, 0.45)",
                    width: 1,
                    points: [p1, p2]
                });
            }
            for (let y = minY; y <= maxY; y++) {
                if (y === 0) continue;
                const p1 = toCanvasPt(minX * step, -y * step);
                const p2 = toCanvasPt(maxX * step, -y * step);
                newLines.push({
                    id: Date.now() + Math.random(),
                    color: "rgba(148, 163, 184, 0.45)",
                    width: 1,
                    points: [p1, p2]
                });
            }
        }

        // 2. Вісь OX
        const oxStart = toCanvasPt((minX - 0.5) * step, 0);
        const oxEnd = toCanvasPt((maxX + 0.8) * step, 0);
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [oxStart, oxEnd]
        });

        // Стрілка OX
        const arrowLen = 12;
        const aOX1 = {
            x: oxEnd.x - arrowLen * Math.cos(rad - Math.PI / 7),
            y: oxEnd.y - arrowLen * Math.sin(rad - Math.PI / 7)
        };
        const aOX2 = {
            x: oxEnd.x - arrowLen * Math.cos(rad + Math.PI / 7),
            y: oxEnd.y - arrowLen * Math.sin(rad + Math.PI / 7)
        };
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [aOX1, oxEnd, aOX2]
        });

        // 3. Вісь OY (вгору у математиці — це -y у CSS)
        const oyStart = toCanvasPt(0, (-minY + 0.5) * step);
        const oyEnd = toCanvasPt(0, (-maxY - 0.8) * step);
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [oyStart, oyEnd]
        });

        // Стрілка OY
        const radY = rad - Math.PI / 2;
        const aOY1 = {
            x: oyEnd.x - arrowLen * Math.cos(radY - Math.PI / 7),
            y: oyEnd.y - arrowLen * Math.sin(radY - Math.PI / 7)
        };
        const aOY2 = {
            x: oyEnd.x - arrowLen * Math.cos(radY + Math.PI / 7),
            y: oyEnd.y - arrowLen * Math.sin(radY + Math.PI / 7)
        };
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [aOY1, oyEnd, aOY2]
        });

        // 4. Поділки та підписи
        for (let x = minX; x <= maxX; x++) {
            if (x === 0) continue;
            const t1 = toCanvasPt(x * step, -5);
            const t2 = toCanvasPt(x * step, 5);
            newLines.push({
                id: Date.now() + Math.random(),
                color: brushSettings.color || "#0f172a",
                width: 1.5,
                points: [t1, t2]
            });

            if (plane.showNumbers) {
                const textPos = toCanvasPt(x * step - 4, 18);
                newLines.push({
                    id: Date.now() + Math.random(),
                    tool: "text",
                    text: String(x),
                    fontSize: 13,
                    color: brushSettings.color || "#0f172a",
                    points: [textPos]
                });
            }
        }

        for (let y = minY; y <= maxY; y++) {
            if (y === 0) continue;
            const t1 = toCanvasPt(-5, -y * step);
            const t2 = toCanvasPt(5, -y * step);
            newLines.push({
                id: Date.now() + Math.random(),
                color: brushSettings.color || "#0f172a",
                width: 1.5,
                points: [t1, t2]
            });

            if (plane.showNumbers) {
                const textPos = toCanvasPt(-20, -y * step + 6);
                newLines.push({
                    id: Date.now() + Math.random(),
                    tool: "text",
                    text: String(y),
                    fontSize: 13,
                    color: brushSettings.color || "#0f172a",
                    points: [textPos]
                });
            }
        }

        // Початок координат '0'
        if (plane.showNumbers) {
            newLines.push({
                id: Date.now() + Math.random(),
                tool: "text",
                text: "0",
                fontSize: 13,
                color: brushSettings.color || "#0f172a",
                points: [toCanvasPt(-14, 16)]
            });
        }

        // Підписи осей 'x' і 'y'
        newLines.push({
            id: Date.now() + Math.random(),
            tool: "text",
            text: plane.labelX || "x",
            fontSize: 16,
            color: brushSettings.color || "#0f172a",
            points: [toCanvasPt((maxX + 0.9) * step, 16)]
        });
        newLines.push({
            id: Date.now() + Math.random(),
            tool: "text",
            text: plane.labelY || "y",
            fontSize: 16,
            color: brushSettings.color || "#0f172a",
            points: [toCanvasPt(12, (-maxY - 0.9) * step)]
        });

        boardData.lines = [...boardData.lines, ...newLines];
    }
</script>

{#if boardData.coordPlanes2D && boardData.coordPlanes2D.length > 0}
    <div class="coord-planes-layer">
        {#each boardData.coordPlanes2D as plane (plane.id)}
            {@const screenPos = getScreenCoords(plane)}
            {@const step = (plane.stepPx || 40) * (plane.scaleFactor || 1.0)}
            {@const minX = plane.minX ?? -5}
            {@const maxX = plane.maxX ?? 5}
            {@const minY = plane.minY ?? -5}
            {@const maxY = plane.maxY ?? 5}

            {@const leftPx = (minX - 0.6) * step}
            {@const rightPx = (maxX + 0.9) * step}
            {@const bottomPx = (-minY + 0.6) * step}
            {@const topPx = (-maxY - 0.9) * step}

            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="coord-plane-container"
                style="
                    left: {screenPos.x}px;
                    top: {screenPos.y}px;
                    transform: rotate({plane.angle || 0}deg) scale({boardData.zoom});
                    transform-origin: 0 0;
                "
            >
                <svg
                    class="coord-plane-svg"
                    style="overflow: visible;"
                >
                    <!-- Координатна сітка -->
                    {#if plane.showGrid}
                        <g stroke="rgba(148, 163, 184, 0.4)" stroke-width="1" stroke-dasharray="2 3">
                            {#each Array(maxX - minX + 1) as _, i}
                                {@const vx = minX + i}
                                {#if vx !== 0}
                                    <line
                                        x1={vx * step}
                                        y1={-maxY * step}
                                        x2={vx * step}
                                        y2={-minY * step}
                                    />
                                {/if}
                            {/each}
                            {#each Array(maxY - minY + 1) as _, i}
                                {@const vy = minY + i}
                                {#if vy !== 0}
                                    <line
                                        x1={minX * step}
                                        y1={-vy * step}
                                        x2={maxX * step}
                                        y2={-vy * step}
                                    />
                                {/if}
                            {/each}
                        </g>
                    {/if}

                    <!-- Вісь OX -->
                    <line
                        x1={leftPx}
                        y1="0"
                        x2={rightPx}
                        y2="0"
                        stroke="#0f172a"
                        stroke-width="2.2"
                    />
                    <!-- Стрілка OX -->
                    <polygon
                        points="{rightPx},0 {rightPx - 11},-5 {rightPx - 7},0 {rightPx - 11},5"
                        fill="#0f172a"
                    />
                    <!-- Підпис OX -->
                    <text
                        x={rightPx + 4}
                        y="16"
                        font-size="16"
                        font-weight="bold"
                        font-style="italic"
                        font-family="system-ui, -apple-system, sans-serif"
                        fill="#0f172a"
                        user-select="none"
                    >
                        {plane.labelX || 'x'}
                    </text>

                    <!-- Вісь OY -->
                    <line
                        x1="0"
                        y1={bottomPx}
                        x2="0"
                        y2={topPx}
                        stroke="#0f172a"
                        stroke-width="2.2"
                    />
                    <!-- Стрілка OY -->
                    <polygon
                        points="0,{topPx} -5,{topPx + 11} 0,{topPx + 7} 5,{topPx + 11}"
                        fill="#0f172a"
                    />
                    <!-- Підпис OY -->
                    <text
                        x="12"
                        y={topPx + 6}
                        font-size="16"
                        font-weight="bold"
                        font-style="italic"
                        font-family="system-ui, -apple-system, sans-serif"
                        fill="#0f172a"
                        user-select="none"
                    >
                        {plane.labelY || 'y'}
                    </text>

                    <!-- Поділки та числа на OX -->
                    {#each Array(maxX - minX + 1) as _, i}
                        {@const vx = minX + i}
                        {@const xPos = vx * step}
                        {#if vx !== 0}
                            <line
                                x1={xPos}
                                y1="-5"
                                x2={xPos}
                                y2="5"
                                stroke="#1e293b"
                                stroke-width="1.8"
                            />
                            {#if plane.showNumbers}
                                <text
                                    x={xPos}
                                    y="18"
                                    font-size="12"
                                    font-weight="500"
                                    font-family="system-ui, -apple-system, sans-serif"
                                    fill="#475569"
                                    text-anchor="middle"
                                    user-select="none"
                                >
                                    {vx}
                                </text>
                            {/if}
                        {/if}
                    {/each}

                    <!-- Поділки та числа на OY -->
                    {#each Array(maxY - minY + 1) as _, i}
                        {@const vy = minY + i}
                        {@const yPos = -vy * step}
                        {#if vy !== 0}
                            <line
                                x1="-5"
                                y1={yPos}
                                x2="5"
                                y2={yPos}
                                stroke="#1e293b"
                                stroke-width="1.8"
                            />
                            {#if plane.showNumbers}
                                <text
                                    x="-8"
                                    y={yPos + 4}
                                    font-size="12"
                                    font-weight="500"
                                    font-family="system-ui, -apple-system, sans-serif"
                                    fill="#475569"
                                    text-anchor="end"
                                    user-select="none"
                                >
                                    {vy}
                                </text>
                            {/if}
                        {/if}
                    {/each}

                    <!-- Число 0 на початку відліку -->
                    {#if plane.showNumbers}
                        <text
                            x="-7"
                            y="16"
                            font-size="12"
                            font-weight="bold"
                            font-family="system-ui, -apple-system, sans-serif"
                            fill="#0f172a"
                            text-anchor="end"
                            user-select="none"
                        >
                            0
                        </text>
                    {/if}
                </svg>

                <!-- Контроли та ручки -->
                <!-- 1. Move Handle (У центрі (0,0)) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle move-handle"
                    style="left: 0px; top: 0px;"
                    onpointerdown={(e) => startMove(e, plane)}
                    title="Затисніть і тягніть для переміщення площини"
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

                <!-- 2. Rotate Handle (Біля кінця осі OX) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle rotate-handle"
                    style="left: {rightPx + 16}px; top: -20px;"
                    onpointerdown={(e) => startRotate(e, plane)}
                    title="Обертати систему координат"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                </div>

                <!-- 3. Scale Handle (У кутку площини) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle scale-handle"
                    style="left: {maxX * step + 16}px; top: {-maxY * step - 16}px;"
                    onpointerdown={(e) => startScale(e, plane)}
                    title="Масштабувати крок сітки"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                </div>

                <!-- 4. Resize X+ Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle limit-handle"
                    style="left: {maxX * step}px; top: 0px;"
                    onpointerdown={(e) => startResize(e, plane, 'resizeXMax')}
                    title="Змінити межу X+ ({maxX})"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

                <!-- 5. Resize X- Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle limit-handle"
                    style="left: {minX * step}px; top: 0px;"
                    onpointerdown={(e) => startResize(e, plane, 'resizeXMin')}
                    title="Змінити межу X- ({minX})"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </div>

                <!-- 6. Resize Y+ Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle limit-handle"
                    style="left: 0px; top: {-maxY * step}px;"
                    onpointerdown={(e) => startResize(e, plane, 'resizeYMax')}
                    title="Змінити межу Y+ ({maxY})"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                </div>

                <!-- 7. Resize Y- Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle limit-handle"
                    style="left: 0px; top: {-minY * step}px;"
                    onpointerdown={(e) => startResize(e, plane, 'resizeYMin')}
                    title="Змінити межу Y- ({minY})"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>

                <!-- 8. Toggle Grid Button -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle toggle-handle"
                    class:active={plane.showGrid}
                    style="left: 28px; top: -28px;"
                    onclick={(e) => { e.stopPropagation(); toggleGrid(plane); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title={plane.showGrid ? "Сховати сітку" : "Показати сітку"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="21" y2="9"></line>
                        <line x1="3" y1="15" x2="21" y2="15"></line>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                        <line x1="15" y1="3" x2="15" y2="21"></line>
                    </svg>
                </div>

                <!-- 9. Toggle Numbers Button -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle toggle-handle"
                    class:active={plane.showNumbers}
                    style="left: 56px; top: -28px;"
                    onclick={(e) => { e.stopPropagation(); toggleNumbers(plane); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title={plane.showNumbers ? "Сховати числа" : "Показати числа"}
                >
                    <span style="font-size: 10px; font-weight: bold;">123</span>
                </div>

                <!-- 10. Stamp Button -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle stamp-handle"
                    style="left: 84px; top: -28px;"
                    onclick={(e) => { e.stopPropagation(); stampToCanvas(plane); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title="Закарбувати на дошці як малюнок"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </div>

                <!-- 11. Delete Button -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle delete-handle"
                    style="left: {leftPx - 14}px; top: 0px;"
                    onclick={(e) => { e.stopPropagation(); deleteCoordPlane2D(plane.id); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title="Видалити координатну площину"
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
    .coord-planes-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 14;
    }

    .coord-plane-container {
        position: absolute;
        pointer-events: none;
        will-change: transform, left, top;
    }

    .coord-plane-svg {
        display: block;
        pointer-events: none;
        filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.07));
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
            width: 18px;
            height: 18px;
            border-radius: 4px;
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
