<script>
    import { boardData, bgSettings, brushSettings, deleteCoordPlane3D } from "$lib";
    import { saveState } from "$lib/history.svelte.js";

    // Track active drag actions: 'move' | 'rotate' | 'axisXAngle' | 'scale' | 'range'
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

    // --- Rotate Entire System Dragging ---
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

    // --- Adjust X Axis Angle & Foreshortening Dragging ---
    function startAxisXDrag(e, plane) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try { target.setPointerCapture(pointerId); } catch (err) {}
        }

        const screenPos = getScreenCoords(plane);

        activeAction = {
            type: "axisX",
            planeId: plane.id,
            pointerId,
            targetEl: target,
            screenX: screenPos.x,
            screenY: screenPos.y,
            initialAngle: plane.axisXAngle || 135,
            initialForeshortening: plane.axisXForeshortening || 0.5,
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

    // --- Range Dragging (Axis Length) ---
    function startRange(e, plane, axisName) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try { target.setPointerCapture(pointerId); } catch (err) {}
        }

        activeAction = {
            type: "range",
            axisName,
            planeId: plane.id,
            pointerId,
            targetEl: target,
            startX: e.clientX,
            startY: e.clientY,
            initialRange: plane[`range${axisName}`] || 5,
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopAction);
        window.addEventListener("pointercancel", stopAction);
    }

    function handlePointerMove(e) {
        if (!activeAction) return;
        if (activeAction.pointerId !== null && e.pointerId !== activeAction.pointerId) return;

        const planeIndex = (boardData.coordPlanes3D || []).findIndex(p => p.id === activeAction.planeId);
        if (planeIndex === -1) return;
        const plane = boardData.coordPlanes3D[planeIndex];

        const step = (plane.stepPx || 40) * (plane.scaleFactor || 1.0);
        const rad = ((plane.angle || 0) * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        const dxCanvas = (e.clientX - activeAction.startX) / boardData.zoom;
        const dyCanvas = (e.clientY - activeAction.startY) / boardData.zoom;

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
        } else if (activeAction.type === "axisX") {
            const screenDx = e.clientX - activeAction.screenX;
            const screenDy = e.clientY - activeAction.screenY;
            // Angle of vector from origin to pointer in local space
            const canvasDx = screenDx / boardData.zoom;
            const canvasDy = screenDy / boardData.zoom;
            const localX = canvasDx * cosA + canvasDy * sinA;
            const localY = -canvasDx * sinA + canvasDy * cosA;

            let deg = (Math.atan2(localY, localX) * 180) / Math.PI;
            if (deg < 0) deg += 360;

            // Clamped to reasonable range for stereometry (e.g. 100° to 170° or 210° to 250°)
            if (deg >= 90 && deg <= 180) {
                if (Math.abs(deg - 135) < 4) deg = 135;
                plane.axisXAngle = Math.round(deg);
            }

            const dist = Math.hypot(localX, localY);
            const nominalLen = (plane.rangeX || 5) * step;
            if (nominalLen > 0) {
                let k = dist / nominalLen;
                k = Math.max(0.3, Math.min(1.0, k));
                if (Math.abs(k - 0.5) < 0.05) k = 0.5;
                if (Math.abs(k - 0.7) < 0.04) k = 0.707;
                plane.axisXForeshortening = Math.round(k * 100) / 100;
            }
        } else if (activeAction.type === "scale") {
            const lx = dxCanvas * cosA + dyCanvas * sinA;
            let rawScale = activeAction.initialScaleFactor + lx / 150;
            rawScale = Math.max(0.3, Math.min(3.0, rawScale));
            if (Math.abs(rawScale - 1.0) < 0.05) rawScale = 1.0;
            plane.scaleFactor = Math.round(rawScale * 100) / 100;
        } else if (activeAction.type === "range") {
            const lx = dxCanvas * cosA + dyCanvas * sinA;
            const ly = -dxCanvas * sinA + dyCanvas * cosA;
            let delta = 0;
            if (activeAction.axisName === 'Y') delta = Math.round(lx / step);
            else if (activeAction.axisName === 'Z') delta = Math.round(-ly / step);
            else if (activeAction.axisName === 'X') {
                const xRad = ((plane.axisXAngle || 135) * Math.PI) / 180;
                const proj = lx * Math.cos(xRad) + ly * Math.sin(xRad);
                delta = Math.round(proj / (step * (plane.axisXForeshortening || 0.5)));
            }
            const key = `range${activeAction.axisName}`;
            plane[key] = Math.max(2, Math.min(20, activeAction.initialRange + delta));
        }

        boardData.coordPlanes3D[planeIndex] = plane;
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

    function toggleNegative(plane) {
        plane.showNegativeAxes = !plane.showNegativeAxes;
        boardData.coordPlanes3D = [...boardData.coordPlanes3D];
    }

    function togglePlanes(plane) {
        plane.showPlanes = !plane.showPlanes;
        boardData.coordPlanes3D = [...boardData.coordPlanes3D];
    }

    function toggleNumbers(plane) {
        plane.showNumbers = !plane.showNumbers;
        boardData.coordPlanes3D = [...boardData.coordPlanes3D];
    }

    function stampToCanvas(plane) {
        saveState();
        const step = (plane.stepPx || 40) * (plane.scaleFactor || 1.0);
        const rad = ((plane.angle || 0) * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        const xAngleRad = ((plane.axisXAngle || 135) * Math.PI) / 180;
        const kX = plane.axisXForeshortening || 0.5;

        const rangeX = plane.rangeX || 5;
        const rangeY = plane.rangeY || 5;
        const rangeZ = plane.rangeZ || 5;

        const toCanvasPt = (lx, ly) => ({
            x: plane.x + lx * cosA - ly * sinA,
            y: plane.y + lx * sinA + ly * cosA
        });

        const newLines = [];

        // 1. Площини проекцій (якщо ввімкнено)
        if (plane.showPlanes) {
            // Площина Oyz (прямокутна сітка вгору-вправо)
            for (let y = 1; y <= rangeY; y++) {
                newLines.push({
                    id: Date.now() + Math.random(),
                    color: "rgba(148, 163, 184, 0.4)",
                    width: 1,
                    points: [toCanvasPt(y * step, 0), toCanvasPt(y * step, -rangeZ * step)]
                });
            }
            for (let z = 1; z <= rangeZ; z++) {
                newLines.push({
                    id: Date.now() + Math.random(),
                    color: "rgba(148, 163, 184, 0.4)",
                    width: 1,
                    points: [toCanvasPt(0, -z * step), toCanvasPt(rangeY * step, -z * step)]
                });
            }

            // Площина Oxy (косокутна сітка вперед-вправо)
            const uXx = Math.cos(xAngleRad) * step * kX;
            const uXy = Math.sin(xAngleRad) * step * kX;
            for (let x = 1; x <= rangeX; x++) {
                newLines.push({
                    id: Date.now() + Math.random(),
                    color: "rgba(148, 163, 184, 0.4)",
                    width: 1,
                    points: [toCanvasPt(x * uXx, x * uXy), toCanvasPt(x * uXx + rangeY * step, x * uXy)]
                });
            }
            for (let y = 1; y <= rangeY; y++) {
                newLines.push({
                    id: Date.now() + Math.random(),
                    color: "rgba(148, 163, 184, 0.4)",
                    width: 1,
                    points: [toCanvasPt(y * step, 0), toCanvasPt(y * step + rangeX * uXx, rangeX * uXy)]
                });
            }
        }

        // 2. Від'ємні півосі (пунктир)
        if (plane.showNegativeAxes) {
            // -Z
            newLines.push({
                id: Date.now() + Math.random(),
                tool: "shape",
                shapeType: "dashed_line",
                color: "#64748b",
                width: 1.5,
                points: [toCanvasPt(0, 0), toCanvasPt(0, 2.5 * step)]
            });
            // -Y
            newLines.push({
                id: Date.now() + Math.random(),
                tool: "shape",
                shapeType: "dashed_line",
                color: "#64748b",
                width: 1.5,
                points: [toCanvasPt(0, 0), toCanvasPt(-2.5 * step, 0)]
            });
            // -X
            const uXx = Math.cos(xAngleRad) * step * kX;
            const uXy = Math.sin(xAngleRad) * step * kX;
            newLines.push({
                id: Date.now() + Math.random(),
                tool: "shape",
                shapeType: "dashed_line",
                color: "#64748b",
                width: 1.5,
                points: [toCanvasPt(0, 0), toCanvasPt(-2.5 * uXx, -2.5 * uXy)]
            });
        }

        // 3. Додатні осі
        // Вісь OY (вправо)
        const oyEnd = toCanvasPt((rangeY + 0.8) * step, 0);
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [toCanvasPt(0, 0), oyEnd]
        });
        // Стрілка OY
        const arrowLen = 12;
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [
                { x: oyEnd.x - arrowLen * Math.cos(rad - Math.PI / 7), y: oyEnd.y - arrowLen * Math.sin(rad - Math.PI / 7) },
                oyEnd,
                { x: oyEnd.x - arrowLen * Math.cos(rad + Math.PI / 7), y: oyEnd.y - arrowLen * Math.sin(rad + Math.PI / 7) }
            ]
        });

        // Вісь OZ (вгору)
        const ozEnd = toCanvasPt(0, (-rangeZ - 0.8) * step);
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [toCanvasPt(0, 0), ozEnd]
        });
        // Стрілка OZ
        const radZ = rad - Math.PI / 2;
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [
                { x: ozEnd.x - arrowLen * Math.cos(radZ - Math.PI / 7), y: ozEnd.y - arrowLen * Math.sin(radZ - Math.PI / 7) },
                ozEnd,
                { x: ozEnd.x - arrowLen * Math.cos(radZ + Math.PI / 7), y: ozEnd.y - arrowLen * Math.sin(radZ + Math.PI / 7) }
            ]
        });

        // Вісь OX (вперед-вліво)
        const uXx = Math.cos(xAngleRad) * step * kX;
        const uXy = Math.sin(xAngleRad) * step * kX;
        const oxEnd = toCanvasPt((rangeX + 0.8) * uXx, (rangeX + 0.8) * uXy);
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [toCanvasPt(0, 0), oxEnd]
        });
        // Стрілка OX
        const radX = rad + xAngleRad;
        newLines.push({
            id: Date.now() + Math.random(),
            color: brushSettings.color || "#0f172a",
            width: 2.2,
            points: [
                { x: oxEnd.x - arrowLen * Math.cos(radX - Math.PI / 7), y: oxEnd.y - arrowLen * Math.sin(radX - Math.PI / 7) },
                oxEnd,
                { x: oxEnd.x - arrowLen * Math.cos(radX + Math.PI / 7), y: oxEnd.y - arrowLen * Math.sin(radX + Math.PI / 7) }
            ]
        });

        // 4. Поділки та підписи
        // На OY
        for (let y = 1; y <= rangeY; y++) {
            newLines.push({
                id: Date.now() + Math.random(),
                color: brushSettings.color || "#0f172a",
                width: 1.5,
                points: [toCanvasPt(y * step, -5), toCanvasPt(y * step, 5)]
            });
            if (plane.showNumbers) {
                newLines.push({
                    id: Date.now() + Math.random(),
                    tool: "text",
                    text: String(y),
                    fontSize: 12,
                    color: brushSettings.color || "#0f172a",
                    points: [toCanvasPt(y * step - 4, 18)]
                });
            }
        }

        // На OZ
        for (let z = 1; z <= rangeZ; z++) {
            newLines.push({
                id: Date.now() + Math.random(),
                color: brushSettings.color || "#0f172a",
                width: 1.5,
                points: [toCanvasPt(-5, -z * step), toCanvasPt(5, -z * step)]
            });
            if (plane.showNumbers) {
                newLines.push({
                    id: Date.now() + Math.random(),
                    tool: "text",
                    text: String(z),
                    fontSize: 12,
                    color: brushSettings.color || "#0f172a",
                    points: [toCanvasPt(-18, -z * step + 6)]
                });
            }
        }

        // На OX
        for (let x = 1; x <= rangeX; x++) {
            const px = x * uXx;
            const py = x * uXy;
            // Perpendicular tick
            const tickPx = 5 * Math.sin(xAngleRad);
            const tickPy = -5 * Math.cos(xAngleRad);
            newLines.push({
                id: Date.now() + Math.random(),
                color: brushSettings.color || "#0f172a",
                width: 1.5,
                points: [toCanvasPt(px - tickPx, py - tickPy), toCanvasPt(px + tickPx, py + tickPy)]
            });
            if (plane.showNumbers) {
                newLines.push({
                    id: Date.now() + Math.random(),
                    tool: "text",
                    text: String(x),
                    fontSize: 12,
                    color: brushSettings.color || "#0f172a",
                    points: [toCanvasPt(px - 14, py + 8)]
                });
            }
        }

        // Підписи осей 'x', 'y', 'z' і початок '0'
        newLines.push({
            id: Date.now() + Math.random(),
            tool: "text",
            text: plane.labelY || "y",
            fontSize: 16,
            color: brushSettings.color || "#0f172a",
            points: [toCanvasPt((rangeY + 0.9) * step, 16)]
        });
        newLines.push({
            id: Date.now() + Math.random(),
            tool: "text",
            text: plane.labelZ || "z",
            fontSize: 16,
            color: brushSettings.color || "#0f172a",
            points: [toCanvasPt(12, (-rangeZ - 0.9) * step)]
        });
        newLines.push({
            id: Date.now() + Math.random(),
            tool: "text",
            text: plane.labelX || "x",
            fontSize: 16,
            color: brushSettings.color || "#0f172a",
            points: [toCanvasPt((rangeX + 0.9) * uXx - 14, (rangeX + 0.9) * uXy + 14)]
        });

        if (plane.showNumbers) {
            newLines.push({
                id: Date.now() + Math.random(),
                tool: "text",
                text: "0",
                fontSize: 13,
                color: brushSettings.color || "#0f172a",
                points: [toCanvasPt(-12, 14)]
            });
        }

        boardData.lines = [...boardData.lines, ...newLines];
    }
</script>

{#if boardData.coordPlanes3D && boardData.coordPlanes3D.length > 0}
    <div class="coord-planes-3d-layer">
        {#each boardData.coordPlanes3D as plane (plane.id)}
            {@const screenPos = getScreenCoords(plane)}
            {@const step = (plane.stepPx || 40) * (plane.scaleFactor || 1.0)}
            {@const rangeX = plane.rangeX || 5}
            {@const rangeY = plane.rangeY || 5}
            {@const rangeZ = plane.rangeZ || 5}
            {@const xAngleRad = ((plane.axisXAngle || 135) * Math.PI) / 180}
            {@const kX = plane.axisXForeshortening || 0.5}

            {@const uXx = Math.cos(xAngleRad) * step * kX}
            {@const uXy = Math.sin(xAngleRad) * step * kX}

            {@const oxEndPx = { x: (rangeX + 0.8) * uXx, y: (rangeX + 0.8) * uXy }}
            {@const oyEndPx = { x: (rangeY + 0.8) * step, y: 0 }}
            {@const ozEndPx = { x: 0, y: (-rangeZ - 0.8) * step }}

            {@const arrowLen = 11}
            {@const a1x = oxEndPx.x - arrowLen * Math.cos(xAngleRad - Math.PI / 7)}
            {@const a1y = oxEndPx.y - arrowLen * Math.sin(xAngleRad - Math.PI / 7)}
            {@const a2x = oxEndPx.x - arrowLen * Math.cos(xAngleRad + Math.PI / 7)}
            {@const a2y = oxEndPx.y - arrowLen * Math.sin(xAngleRad + Math.PI / 7)}

            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="coord-plane-3d-container"
                style="
                    left: {screenPos.x}px;
                    top: {screenPos.y}px;
                    transform: rotate({plane.angle || 0}deg) scale({boardData.zoom});
                    transform-origin: 0 0;
                "
            >
                <svg
                    class="coord-plane-3d-svg"
                    style="overflow: visible;"
                >
                    <!-- 1. Координатні площини-сітки -->
                    {#if plane.showPlanes}
                        <g stroke="rgba(148, 163, 184, 0.35)" stroke-width="1" stroke-dasharray="2 3">
                            <!-- Oyz Grid -->
                            {#each Array(rangeY) as _, i}
                                {@const y = i + 1}
                                <line x1={y * step} y1="0" x2={y * step} y2={-rangeZ * step} />
                            {/each}
                            {#each Array(rangeZ) as _, i}
                                {@const z = i + 1}
                                <line x1="0" y1={-z * step} x2={rangeY * step} y2={-z * step} />
                            {/each}

                            <!-- Oxy Grid -->
                            {#each Array(rangeX) as _, i}
                                {@const x = i + 1}
                                <line x1={x * uXx} y1={x * uXy} x2={x * uXx + rangeY * step} y2={x * uXy} />
                            {/each}
                            {#each Array(rangeY) as _, i}
                                {@const y = i + 1}
                                <line x1={y * step} y1="0" x2={y * step + rangeX * uXx} y2={rangeX * uXy} />
                            {/each}

                            <!-- Oxz Grid -->
                            {#each Array(rangeX) as _, i}
                                {@const x = i + 1}
                                <line x1={x * uXx} y1={x * uXy} x2={x * uXx} y2={x * uXy - rangeZ * step} />
                            {/each}
                            {#each Array(rangeZ) as _, i}
                                {@const z = i + 1}
                                <line x1="0" y1={-z * step} x2={rangeX * uXx} y2={-z * step + rangeX * uXy} />
                            {/each}
                        </g>
                    {/if}

                    <!-- 2. Від'ємні півосі (пунктир) -->
                    {#if plane.showNegativeAxes}
                        <g stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="4 4">
                            <line x1="0" y1="0" x2="0" y2={2.5 * step} />
                            <line x1="0" y1="0" x2={-2.5 * step} y2="0" />
                            <line x1="0" y1="0" x2={-2.5 * uXx} y2={-2.5 * uXy} />
                        </g>
                    {/if}

                    <!-- 3. Додатні осі -->
                    <!-- Вісь OY -->
                    <line x1="0" y1="0" x2={oyEndPx.x} y2="0" stroke="#0f172a" stroke-width="2.2" />
                    <polygon points="{oyEndPx.x},0 {oyEndPx.x - 11},-5 {oyEndPx.x - 7},0 {oyEndPx.x - 11},5" fill="#0f172a" />
                    <text x={oyEndPx.x + 4} y="16" font-size="16" font-weight="bold" font-style="italic" font-family="system-ui, -apple-system, sans-serif" fill="#0f172a" user-select="none">
                        {plane.labelY || 'y'}
                    </text>

                    <!-- Вісь OZ -->
                    <line x1="0" y1="0" x2="0" y2={ozEndPx.y} stroke="#0f172a" stroke-width="2.2" />
                    <polygon points="0,{ozEndPx.y} -5,{ozEndPx.y + 11} 0,{ozEndPx.y + 7} 5,{ozEndPx.y + 11}" fill="#0f172a" />
                    <text x="12" y={ozEndPx.y + 6} font-size="16" font-weight="bold" font-style="italic" font-family="system-ui, -apple-system, sans-serif" fill="#0f172a" user-select="none">
                        {plane.labelZ || 'z'}
                    </text>

                    <!-- Вісь OX -->
                    <line x1="0" y1="0" x2={oxEndPx.x} y2={oxEndPx.y} stroke="#0f172a" stroke-width="2.2" />
                    <!-- Стрілка OX -->
                    <polygon points="{oxEndPx.x},{oxEndPx.y} {a1x},{a1y} {oxEndPx.x - 7 * Math.cos(xAngleRad)},{oxEndPx.y - 7 * Math.sin(xAngleRad)} {a2x},{a2y}" fill="#0f172a" />
                    <text x={oxEndPx.x - 14} y={oxEndPx.y + 16} font-size="16" font-weight="bold" font-style="italic" font-family="system-ui, -apple-system, sans-serif" fill="#0f172a" user-select="none">
                        {plane.labelX || 'x'}
                    </text>

                    <!-- 4. Поділки та числа -->
                    <!-- OY Ticks -->
                    {#each Array(rangeY) as _, i}
                        {@const y = i + 1}
                        {@const yPos = y * step}
                        <line x1={yPos} y1="-5" x2={yPos} y2="5" stroke="#1e293b" stroke-width="1.8" />
                        {#if plane.showNumbers}
                            <text x={yPos} y="18" font-size="12" font-weight="500" font-family="system-ui, -apple-system, sans-serif" fill="#475569" text-anchor="middle" user-select="none">
                                {y}
                            </text>
                        {/if}
                    {/each}

                    <!-- OZ Ticks -->
                    {#each Array(rangeZ) as _, i}
                        {@const z = i + 1}
                        {@const zPos = -z * step}
                        <line x1="-5" y1={zPos} x2="5" y2={zPos} stroke="#1e293b" stroke-width="1.8" />
                        {#if plane.showNumbers}
                            <text x="-8" y={zPos + 4} font-size="12" font-weight="500" font-family="system-ui, -apple-system, sans-serif" fill="#475569" text-anchor="end" user-select="none">
                                {z}
                            </text>
                        {/if}
                    {/each}

                    <!-- OX Ticks -->
                    {#each Array(rangeX) as _, i}
                        {@const x = i + 1}
                        {@const px = x * uXx}
                        {@const py = x * uXy}
                        {@const tickPx = 5 * Math.sin(xAngleRad)}
                        {@const tickPy = -5 * Math.cos(xAngleRad)}
                        <line x1={px - tickPx} y1={py - tickPy} x2={px + tickPx} y2={py + tickPy} stroke="#1e293b" stroke-width="1.8" />
                        {#if plane.showNumbers}
                            <text x={px - 10} y={py + 8} font-size="12" font-weight="500" font-family="system-ui, -apple-system, sans-serif" fill="#475569" text-anchor="end" user-select="none">
                                {x}
                            </text>
                        {/if}
                    {/each}

                    <!-- 0 Origin -->
                    {#if plane.showNumbers}
                        <text x="-7" y="15" font-size="12" font-weight="bold" font-family="system-ui, -apple-system, sans-serif" fill="#0f172a" text-anchor="end" user-select="none">
                            0
                        </text>
                    {/if}
                </svg>

                <!-- Контроли та ручки -->
                <!-- 1. Move Handle (Центр (0,0,0)) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle move-handle"
                    style="left: 0px; top: 0px;"
                    onpointerdown={(e) => startMove(e, plane)}
                    title="Затисніть і тягніть для переміщення просторової системи"
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

                <!-- 2. Rotate Entire Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle rotate-handle"
                    style="left: {oyEndPx.x + 16}px; top: -20px;"
                    onpointerdown={(e) => startRotate(e, plane)}
                    title="Обертати систему координат"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                </div>

                <!-- 3. Adjust OX Angle & Foreshortening Handle (На кінці осі OX) -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle angle-handle"
                    style="left: {rangeX * uXx}px; top: {rangeX * uXy}px;"
                    onpointerdown={(e) => startAxisXDrag(e, plane)}
                    title="Змінити кут та масштаб осі X (стереометрична перспектива)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                </div>

                <!-- 4. Scale Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle scale-handle"
                    style="left: {rangeY * step + 16}px; top: {-rangeZ * step - 16}px;"
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

                <!-- 5. Range Y Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle limit-handle"
                    style="left: {rangeY * step}px; top: 0px;"
                    onpointerdown={(e) => startRange(e, plane, 'Y')}
                    title="Змінити довжину осі Y ({rangeY})"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>

                <!-- 6. Range Z Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle limit-handle"
                    style="left: 0px; top: {-rangeZ * step}px;"
                    onpointerdown={(e) => startRange(e, plane, 'Z')}
                    title="Змінити довжину осі Z ({rangeZ})"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                </div>

                <!-- 7. Toggle Negative Axes -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle toggle-handle"
                    class:active={plane.showNegativeAxes}
                    style="left: 28px; top: -28px;"
                    onclick={(e) => { e.stopPropagation(); toggleNegative(plane); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title={plane.showNegativeAxes ? "Сховати від'ємні півосі" : "Показати від'ємні півосі"}
                >
                    <span style="font-size: 11px; font-weight: bold;">±</span>
                </div>

                <!-- 8. Toggle Coordinate Planes -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle toggle-handle"
                    class:active={plane.showPlanes}
                    style="left: 56px; top: -28px;"
                    onclick={(e) => { e.stopPropagation(); togglePlanes(plane); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title={plane.showPlanes ? "Сховати площини сітки" : "Показати площини сітки"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                </div>

                <!-- 9. Toggle Numbers -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle toggle-handle"
                    class:active={plane.showNumbers}
                    style="left: 84px; top: -28px;"
                    onclick={(e) => { e.stopPropagation(); toggleNumbers(plane); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title={plane.showNumbers ? "Сховати числа" : "Показати числа"}
                >
                    <span style="font-size: 10px; font-weight: bold;">123</span>
                </div>

                <!-- 10. Stamp to Canvas -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle stamp-handle"
                    style="left: 112px; top: -28px;"
                    onclick={(e) => { e.stopPropagation(); stampToCanvas(plane); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title="Закарбувати на дошці як малюнок"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </div>

                <!-- 11. Delete Handle -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="tool-handle delete-handle"
                    style="left: -28px; top: 0px;"
                    onclick={(e) => { e.stopPropagation(); deleteCoordPlane3D(plane.id); }}
                    onpointerdown={(e) => e.stopPropagation()}
                    title="Видалити просторову систему координат"
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
    .coord-planes-3d-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 14;
    }

    .coord-plane-3d-container {
        position: absolute;
        pointer-events: none;
        will-change: transform, left, top;
    }

    .coord-plane-3d-svg {
        display: block;
        pointer-events: none;
        filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.08));
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

        &.angle-handle {
            width: 22px;
            height: 22px;
            border-color: #0891b2;
            color: #0891b2;
            box-shadow: 0 2px 8px rgba(8, 145, 178, 0.25);

            &:hover {
                background: #0891b2;
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
