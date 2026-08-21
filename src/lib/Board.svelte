<script>
    import { onMount, untrack } from "svelte";
    import { brushSettings, boardData, bgSettings, saveState } from "$lib";
    import SelectionMenu from "./SelectionMenu.svelte";
    import { drawShape } from "./shapeRenderer.js";

    let canvas;
    let ctx;

    // Стани малювання ліній
    let isDrawing = $state(false);
    let currentLineId = $state(null); // Запам'ятовуємо тільки ID поточної лінії

    // Стани для виділення та перетягування
    let isMoving = $state(false); // Переміщення ліній
    let isPanning = $state(false); // Переміщення всієї дошки
    let isSelectingArea = $state(false); // Малювання рамки виділення
    let isResizing = $state(false); // Зміна розміру

    // Змінні для масштабування
    let activeResizeHandle = $state(null); // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
    let resizeOriginalLine = null;
    let resizeOriginalBB = null;
    let resizeCursor = $state("default");

    let startX = $state(0);
    let startY = $state(0);
    let currentX = $state(0);
    let currentY = $state(0);

    // Координати миші для кастомного курсора
    let mouseX = $state(-100);
    let mouseY = $state(-100);
    let showCursor = $state(false);

    // Стани для копіювання
    let isCopying = $state(false);
    let copiedLines = $state([]);
    let copyOrigin = $state({ x: 0, y: 0 });

    // Позиція меню
    let showMenu = $state(false);
    let menuPos = $state({ x: 0, y: 0 });

    let offscreenCanvas;
    let offscreenCtx;

    // Змінні для жестів двома пальцями (pinch-to-zoom / pan)
    let activePointers = new Map();
    let isTwoFingerGesturing = false;
    let initialTouchDistance = 0;
    let initialTouchCenter = { x: 0, y: 0 };
    let initialZoom = 1;
    let initialOffsetX = 0;
    let initialOffsetY = 0;

    // Стан для вводу тексту
    let textInputState = $state({
        active: false,
        id: null, // null = новий текст; id = редагування існуючого
        isEditing: false, // true коли редагуємо наявний текст
        x: 0,
        y: 0,
        canvasX: 0,
        canvasY: 0,
        text: "",
        color: "#000",
        fontSize: 24,
    });
    let textInputRef = $state();

    // Стан курсора при hover над об'єктом в select-режимі
    let hoverLineId = $state(null);

    function commitTextInput() {
        if (!textInputState.active) return;
        const trimmed = textInputState.text.trim();
        if (textInputState.isEditing && textInputState.id) {
            // Оновлюємо існуючий текстовий об'єкт
            saveState();
            if (trimmed) {
                boardData.lines = boardData.lines.map((l) =>
                    l.id === textInputState.id
                        ? { ...l, text: textInputState.text }
                        : l,
                );
            } else {
                // Якщо текст порожній — видаляємо об'єкт
                boardData.lines = boardData.lines.filter(
                    (l) => l.id !== textInputState.id,
                );
                boardData.selectedLineIds = [];
            }
        } else if (trimmed) {
            // Додаємо новий текстовий об'єкт
            saveState();
            boardData.lines = [
                ...boardData.lines,
                {
                    id: textInputState.id,
                    tool: "text",
                    text: textInputState.text,
                    color: textInputState.color,
                    fontSize: textInputState.fontSize,
                    points: [
                        {
                            x: textInputState.canvasX,
                            y: textInputState.canvasY,
                        },
                    ],
                },
            ];
        }
        textInputState.active = false;
        redraw();
    }

    function openTextEdit(line) {
        // Відкриваємо textarea для редагування існуючого тексту
        const screenPos = toScreen(line.points[0].x, line.points[0].y);
        textInputState = {
            active: true,
            id: line.id,
            isEditing: true,
            x: screenPos.x,
            y: screenPos.y,
            canvasX: line.points[0].x,
            canvasY: line.points[0].y,
            text: line.text,
            color: line.color,
            fontSize: line.fontSize || 24,
        };
        showMenu = false;
        setTimeout(() => {
            if (textInputRef) {
                textInputRef.focus();
                textInputRef.select();
            }
        }, 10);
    }

    onMount(() => {
        ctx = canvas.getContext("2d");
        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        canvas.addEventListener("wheel", handleWheel, { passive: false });

        const handleBeforeUnload = (e) => {
            if (boardData.lines.length > 0) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("resize", resizeCanvas);
            canvas.removeEventListener("wheel", handleWheel);
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    });

    // Конвертація координат
    function toCanvas(x, y) {
        return {
            x: (x - boardData.offsetX) / boardData.zoom,
            y: (y - boardData.offsetY) / boardData.zoom,
        };
    }

    function toScreen(x, y) {
        return {
            x: x * boardData.zoom + boardData.offsetX,
            y: y * boardData.zoom + boardData.offsetY,
        };
    }

    $effect(() => {
        // Слідкуємо за змінами в даних дошки, щоб автоматично перемальовувати канвас
        boardData.lines;
        boardData.selectedLineIds;
        boardData.zoom;
        boardData.offsetX;
        boardData.offsetY;
        // Слідкуємо за налаштуваннями фону
        bgSettings.overlay;
        bgSettings.scale;
        bgSettings.overlayColor;
        bgSettings.bgColor;
        redraw();
    });

    // Синхронізація налаштувань пензля з виділеною лінією
    $effect(() => {
        const ids = boardData.selectedLineIds;
        const tool = brushSettings.tool;
        if (ids.length === 1 && tool === "select") {
            const selectedLine = boardData.lines.find((l) => l.id === ids[0]);
            if (selectedLine) {
                untrack(() => {
                    if (brushSettings.color !== selectedLine.color) {
                        brushSettings.color = selectedLine.color;
                    }
                    if (brushSettings.width !== selectedLine.width) {
                        brushSettings.width = selectedLine.width;
                    }
                });
            }
        }
    });

    function drawLine(ctx, line) {
        if (!line.points || line.points.length === 0) return;

        ctx.beginPath();
        ctx.lineWidth = line.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const p = line.points;
        ctx.moveTo(p[0].x, p[0].y);

        if (p.length === 1) {
            ctx.lineTo(p[0].x, p[0].y);
        } else if (p.length === 2) {
            ctx.lineTo(p[1].x, p[1].y);
        } else {
            for (let i = 1; i < p.length - 2; i++) {
                const xc = (p[i].x + p[i + 1].x) / 2;
                const yc = (p[i].y + p[i + 1].y) / 2;
                ctx.quadraticCurveTo(p[i].x, p[i].y, xc, yc);
            }
            // For the last 2 points
            ctx.quadraticCurveTo(
                p[p.length - 2].x,
                p[p.length - 2].y,
                p[p.length - 1].x,
                p[p.length - 1].y,
            );
        }
        ctx.stroke();
    }

    function redraw() {
        if (!ctx) return;

        ctx.clearRect(0, 0, 10000, 10000);

        // 1. Малюємо фон
        ctx.fillStyle = bgSettings.bgColor;
        ctx.fillRect(0, 0, 10000, 10000);

        // 2. Малюємо накладку
        drawOverlay();

        // 3. Застосовуємо трансформації для ліній
        ctx.save();
        ctx.translate(boardData.offsetX, boardData.offsetY);
        ctx.scale(boardData.zoom, boardData.zoom);

        // 4. Малюємо всі лінії на офскрін канвасі для підтримки прозорої гумки
        if (offscreenCtx) {
            offscreenCtx.clearRect(
                0,
                0,
                offscreenCanvas.width,
                offscreenCanvas.height,
            );

            // Застосовуємо ті ж трансформації до офскрін канвасу
            offscreenCtx.save();
            offscreenCtx.translate(boardData.offsetX, boardData.offsetY);
            offscreenCtx.scale(boardData.zoom, boardData.zoom);

            boardData.lines.forEach((line) => {
                const isEraser = line.tool === "eraser";

                if (isEraser) {
                    offscreenCtx.globalCompositeOperation = "destination-out";
                } else {
                    offscreenCtx.globalCompositeOperation = "source-over";
                }

                if (boardData.selectedLineIds.includes(line.id)) {
                    offscreenCtx.strokeStyle = "#ff3e00";
                    offscreenCtx.fillStyle = "#ff3e00";
                    offscreenCtx.shadowColor = "rgba(255, 62, 0, 0.6)";
                    offscreenCtx.shadowBlur = 10 / boardData.zoom;
                } else {
                    offscreenCtx.strokeStyle = line.color;
                    offscreenCtx.fillStyle = line.color;
                    offscreenCtx.shadowBlur = 0;
                }

                if (line.tool === "shape") {
                    drawShape(offscreenCtx, line);
                } else if (line.tool === "text") {
                    offscreenCtx.font = `${line.fontSize || 24}px sans-serif`;
                    offscreenCtx.textBaseline = "top";
                    // Якщо багаторядковий текст, можна розділяти по \n, але тут поки простий рядок
                    offscreenCtx.fillText(
                        line.text,
                        line.points[0].x,
                        line.points[0].y,
                    );
                } else {
                    drawLine(offscreenCtx, line);
                }
            });

            offscreenCtx.restore();

            // Малюємо результат з офскрін канвасу на основний
            ctx.restore(); // Скидаємо трансформації перед drawImage, бо офскрін вже відрендерений з ними
            ctx.drawImage(offscreenCanvas, 0, 0);

            // Малюємо маркери ресайзу для одиничного виділення
            if (
                boardData.selectedLineIds.length === 1 &&
                brushSettings.tool === "select"
            ) {
                const selectedLine = boardData.lines.find(
                    (l) => l.id === boardData.selectedLineIds[0],
                );
                if (selectedLine) {
                    const bb = getBoundingBox(selectedLine);
                    const handles = getResizeHandles(bb);

                    ctx.save();
                    ctx.translate(boardData.offsetX, boardData.offsetY);
                    ctx.scale(boardData.zoom, boardData.zoom);

                    // Рамка
                    ctx.beginPath();
                    ctx.rect(
                        bb.minX,
                        bb.minY,
                        bb.maxX - bb.minX,
                        bb.maxY - bb.minY,
                    );
                    ctx.strokeStyle = "#007bff";
                    ctx.lineWidth = 1 / boardData.zoom;
                    ctx.setLineDash([5 / boardData.zoom, 5 / boardData.zoom]);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Маркери
                    ctx.fillStyle = "#ffffff";
                    ctx.strokeStyle = "#007bff";
                    ctx.lineWidth = 1.5 / boardData.zoom;

                    handles.forEach((h) => {
                        ctx.beginPath();
                        ctx.arc(h.x, h.y, 4 / boardData.zoom, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.stroke();
                    });

                    ctx.restore();
                }
            }
        } else {
            ctx.restore();
        }

        // 5. Малюємо пунктирну рамку виділення (вона малюється в екранних координатах для зручності)
        if (isSelectingArea) {
            ctx.beginPath();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = "#007bff";
            ctx.lineWidth = 1;
            ctx.fillStyle = "rgba(0, 123, 255, 0.1)";

            const width = currentX - startX;
            const height = currentY - startY;

            ctx.fillRect(startX, startY, width, height);
            ctx.strokeRect(startX, startY, width, height);
            ctx.setLineDash([]);
        }

        // 6. Малюємо прев'ю скопійованих об'єктів
        if (isCopying && copiedLines.length > 0) {
            const canvasPos = toCanvas(mouseX, mouseY);
            const dx = canvasPos.x - copyOrigin.x;
            const dy = canvasPos.y - copyOrigin.y;

            ctx.save();
            ctx.translate(boardData.offsetX, boardData.offsetY);
            ctx.scale(boardData.zoom, boardData.zoom);
            ctx.globalAlpha = 0.5;

            copiedLines.forEach((line) => {
                ctx.strokeStyle = line.color;
                ctx.fillStyle = line.color;
                const offsetLine = {
                    ...line,
                    points: line.points.map((p) => ({
                        x: p.x + dx,
                        y: p.y + dy,
                    })),
                };
                if (offsetLine.tool === "shape") {
                    drawShape(ctx, offsetLine);
                } else if (offsetLine.tool === "text") {
                    ctx.font = `${offsetLine.fontSize || 24}px sans-serif`;
                    ctx.textBaseline = "top";
                    ctx.fillText(
                        offsetLine.text,
                        offsetLine.points[0].x,
                        offsetLine.points[0].y,
                    );
                } else {
                    drawLine(ctx, offsetLine);
                }
            });
            ctx.restore();
        }

        // 7. Індикатор прилипання до лінійки, косинця, транспортира та циркуля
        if (
            showCursor &&
            ((boardData.rulers && boardData.rulers.length > 0) ||
                (boardData.setSquares && boardData.setSquares.length > 0) ||
                (boardData.protractors && boardData.protractors.length > 0) ||
                (boardData.compasses && boardData.compasses.length > 0) ||
                (boardData.coordLines && boardData.coordLines.length > 0) ||
                (boardData.coordPlanes2D && boardData.coordPlanes2D.length > 0) ||
                (boardData.coordPlanes3D && boardData.coordPlanes3D.length > 0)) &&
            (brushSettings.tool === "brush" ||
                brushSettings.tool === "eraser" ||
                brushSettings.tool === "shape")
        ) {
            const rect2 = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
            const hoverCanvas = toCanvas(mouseX - rect2.left, mouseY - rect2.top);
            const snapResult = snapToRuler(hoverCanvas.x, hoverCanvas.y);
            if (snapResult.isSnapped) {
                ctx.save();
                ctx.translate(boardData.offsetX, boardData.offsetY);
                ctx.scale(boardData.zoom, boardData.zoom);
                ctx.beginPath();
                ctx.arc(snapResult.x, snapResult.y, 5 / boardData.zoom, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(0, 123, 255, 0.85)";
                ctx.fill();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.5 / boardData.zoom;
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    function drawOverlay() {
        const type = bgSettings.overlay;
        if (type === "none") return;

        const step = bgSettings.scale * boardData.zoom;
        if (step < 2) return; // Занадто малий крок — не малюємо

        const startXGrid = boardData.offsetX % step;
        const startYGrid = boardData.offsetY % step;
        const color = bgSettings.overlayColor;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        if (type === "grid") {
            // Вертикальні лінії
            for (let x = startXGrid; x < canvas.width; x += step) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
            }
            // Горизонтальні лінії
            for (let y = startYGrid; y < canvas.height; y += step) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();
        } else if (type === "lines") {
            // Тільки горизонтальні лінії
            for (let y = startYGrid; y < canvas.height; y += step) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();
        } else if (type === "diagonal") {
            // Для письма в молодшій школі (коса лінія)
            const smallHeight = step; // Висота робочого рядка
            const gap = step * 2; // Відстань між рядками
            const patternHeight = smallHeight + gap;

            // Базовий зсув по Y для горизонтальних ліній
            const startY =
                ((boardData.offsetY % patternHeight) + patternHeight) %
                patternHeight;

            // Горизонтальні лінії
            for (
                let y = startY - patternHeight;
                y < canvas.height + patternHeight;
                y += patternHeight
            ) {
                // Верхня лінія робочого рядка
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);

                // Нижня лінія робочого рядка
                ctx.moveTo(0, y + smallHeight);
                ctx.lineTo(canvas.width, y + smallHeight);
            }
            ctx.stroke();

            // Косі лінії — нахил ~65° до горизонталі (нахил вправо "/")
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;

            const diagStep = step * 2.5; // Відстань між косими лініями
            const w = canvas.width;
            const h = canvas.height;

            // dx — зсув по x за всю висоту екрана (tan(25°) ≈ 0.46)
            const dx = h * 0.46;

            // Зсув початку з урахуванням прокрутки (X = X0 - Y * 0.46)
            const diagShift = boardData.offsetX + boardData.offsetY * 0.46;
            const diagOffset = ((diagShift % diagStep) + diagStep) % diagStep;

            for (
                let x = diagOffset - diagStep;
                x < w + dx + diagStep;
                x += diagStep
            ) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x - dx, h);
            }
            ctx.stroke();
        } else if (type === "dots") {
            // Крапки у вузлах сітки
            const dotRadius = Math.max(1, step * 0.06);
            ctx.fillStyle = color;
            for (let x = startXGrid; x < canvas.width + step; x += step) {
                for (let y = startYGrid; y < canvas.height + step; y += step) {
                    ctx.beginPath();
                    ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        } else if (type === "draft") {
            // Сітка для креслення: основна сітка + дрібніша підсітка
            const subStep = step / 5;
            // Дрібна підсітка
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 0.5;
            const subStartX = boardData.offsetX % subStep;
            const subStartY = boardData.offsetY % subStep;
            for (let x = subStartX; x < canvas.width; x += subStep) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
            }
            for (let y = subStartY; y < canvas.height; y += subStep) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
            // Основна сітка
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            for (let x = startXGrid; x < canvas.width; x += step) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
            }
            for (let y = startYGrid; y < canvas.height; y += step) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();
        }
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        if (!offscreenCanvas) {
            offscreenCanvas = document.createElement("canvas");
        }
        offscreenCanvas.width = canvas.width;
        offscreenCanvas.height = canvas.height;
        offscreenCtx = offscreenCanvas.getContext("2d");

        redraw();
    }

    function handleWheel(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Координати миші на канвасі ДО зуму
        const beforeZoom = toCanvas(mouseX, mouseY);

        const zoomSpeed = 0.001;
        let newZoom = boardData.zoom - e.deltaY * zoomSpeed;
        newZoom = Math.max(0.1, Math.min(10, newZoom));

        boardData.zoom = newZoom;

        // Координати миші на канвасі ПІСЛЯ зуму (мають збігатися з beforeZoom)
        // Новий offset = mouse - beforeZoom * zoom
        boardData.offsetX = mouseX - beforeZoom.x * boardData.zoom;
        boardData.offsetY = mouseY - beforeZoom.y * boardData.zoom;

        redraw();
    }

    function getBoundingBox(line) {
        if (line.tool === "text") {
            const w = line.text.length * ((line.fontSize || 24) * 0.6);
            const h = line.fontSize || 24;
            return {
                minX: line.points[0].x,
                minY: line.points[0].y,
                maxX: line.points[0].x + w,
                maxY: line.points[0].y + h,
            };
        } else if (line.tool === "shape") {
            const p1 = line.points[0];
            const p2 = line.points[1] || p1;

            // Стандартні межі (для більшості фігур)
            const stdMinX = Math.min(p1.x, p2.x);
            const stdMinY = Math.min(p1.y, p2.y);
            const stdMaxX = Math.max(p1.x, p2.x);
            const stdMaxY = Math.max(p1.y, p2.y);
            const width = stdMaxX - stdMinX;
            const height = stdMaxY - stdMinY;

            // Для пропорційних фігур — обчислюємо точні межі, як у shapeRenderer.js
            switch (line.shapeType) {
                case "circle":
                case "sphere": {
                    // arc(p1.x, p1.y, radius, ...) де radius = dist(p1, p2)
                    const radius = Math.sqrt(
                        (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2,
                    );
                    return {
                        minX: p1.x - radius,
                        minY: p1.y - radius,
                        maxX: p1.x + radius,
                        maxY: p1.y + radius,
                    };
                }
                case "square": {
                    // rect від p1, зі стороною = max(|dx|, |dy|)
                    const sqSide = Math.max(
                        Math.abs(p2.x - p1.x),
                        Math.abs(p2.y - p1.y),
                    );
                    const sx = p2.x < p1.x ? p1.x - sqSide : p1.x;
                    const sy = p2.y < p1.y ? p1.y - sqSide : p1.y;
                    return {
                        minX: sx,
                        minY: sy,
                        maxX: sx + sqSide,
                        maxY: sy + sqSide,
                    };
                }
                case "equilateral_triangle": {
                    // вершина в (p1.x, p1.y - eh), основа симетрична навколо p1.x
                    const eqSide = Math.max(
                        Math.abs(p2.x - p1.x),
                        Math.abs(p2.y - p1.y),
                    );
                    const eh = (eqSide * Math.sqrt(3)) / 2;
                    return {
                        minX: p1.x - eqSide / 2,
                        minY: p1.y - eh,
                        maxX: p1.x + eqSide / 2,
                        maxY: p1.y + eh / 2,
                    };
                }
                case "cube": {
                    // Front face від p1, back face зміщена на (cdx, -cdy)
                    const cubeSide =
                        Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)) *
                        0.7;
                    const cdx = cubeSide * 0.4;
                    const cdy = cubeSide * 0.4;
                    return {
                        minX: p1.x,
                        minY: p1.y - cdy,
                        maxX: p1.x + cubeSide + cdx,
                        maxY: p1.y + cubeSide,
                    };
                }
                case "parallelepiped": {
                    // Front face від p1, back face зміщена на (pdx, -pdy)
                    const ppw = width * 0.7;
                    const pph = height * 0.7;
                    const pdx = width * 0.3;
                    const pdy = height * 0.3;
                    return {
                        minX: p1.x,
                        minY: p1.y - pdy,
                        maxX: p1.x + ppw + pdx,
                        maxY: p1.y + pph,
                    };
                }
                default:
                    // rectangle, ellipse, triangle, right_triangle, trapezoid,
                    // parallelogram, cylinder, cone, pyramid, line, arrow тощо
                    return {
                        minX: stdMinX,
                        minY: stdMinY,
                        maxX: stdMaxX,
                        maxY: stdMaxY,
                    };
            }
        } else {
            let minX = Infinity,
                minY = Infinity,
                maxX = -Infinity,
                maxY = -Infinity;
            line.points.forEach((p) => {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            });
            return { minX, minY, maxX, maxY };
        }
    }

    function getResizeHandles(bb) {
        const size = 10 / boardData.zoom;
        const hw = size / 2;
        const cx = (bb.minX + bb.maxX) / 2;
        const cy = (bb.minY + bb.maxY) / 2;

        return [
            {
                id: "nw",
                x: bb.minX,
                y: bb.minY,
                rect: [bb.minX - hw, bb.minY - hw, size, size],
                cursor: "nwse-resize",
            },
            {
                id: "n",
                x: cx,
                y: bb.minY,
                rect: [cx - hw, bb.minY - hw, size, size],
                cursor: "ns-resize",
            },
            {
                id: "ne",
                x: bb.maxX,
                y: bb.minY,
                rect: [bb.maxX - hw, bb.minY - hw, size, size],
                cursor: "nesw-resize",
            },
            {
                id: "e",
                x: bb.maxX,
                y: cy,
                rect: [bb.maxX - hw, cy - hw, size, size],
                cursor: "ew-resize",
            },
            {
                id: "se",
                x: bb.maxX,
                y: bb.maxY,
                rect: [bb.maxX - hw, bb.maxY - hw, size, size],
                cursor: "nwse-resize",
            },
            {
                id: "s",
                x: cx,
                y: bb.maxY,
                rect: [cx - hw, bb.maxY - hw, size, size],
                cursor: "ns-resize",
            },
            {
                id: "sw",
                x: bb.minX,
                y: bb.maxY,
                rect: [bb.minX - hw, bb.maxY - hw, size, size],
                cursor: "nesw-resize",
            },
            {
                id: "w",
                x: bb.minX,
                y: cy,
                rect: [bb.minX - hw, cy - hw, size, size],
                cursor: "ew-resize",
            },
        ];
    }

    // Перевірка, чи потрапила лінія в зону прямокутника
    function isLineInSelectArea(x1, y1, x2, y2, line) {
        // Конвертуємо рамку виділення (яка в екранних координатах) в координати канвасу
        const p1 = toCanvas(x1, y1);
        const p2 = toCanvas(x2, y2);

        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        if (line.tool === "shape" || line.tool === "text") {
            const bb = getBoundingBox(line);
            return !(
                bb.maxX < minX ||
                bb.minX > maxX ||
                bb.maxY < minY ||
                bb.minY > maxY
            );
        }

        // Якщо хоча б одна точка лінії лежить всередині рамки — лінія вважається виділеною
        return line.points.some(
            (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
        );
    }

    // Прилипання до краю лінійки, косинця, транспортира та циркуля (повертає снапнуту точку або оригінальну)
    function snapToRuler(canvasX, canvasY) {
        const hasRulers = boardData.rulers && boardData.rulers.length > 0;
        const hasSetSquares = boardData.setSquares && boardData.setSquares.length > 0;
        const hasProtractors = boardData.protractors && boardData.protractors.length > 0;
        const hasCompasses = boardData.compasses && boardData.compasses.length > 0;
        if (!hasRulers && !hasSetSquares && !hasProtractors && !hasCompasses) {
            return { x: canvasX, y: canvasY, isSnapped: false };
        }

        const snapThreshold = 20 / boardData.zoom;
        let bestSnap = null;
        let minDist = snapThreshold;

        if (hasRulers) {
            for (const ruler of boardData.rulers) {
                // Canvas width of ruler in canvas pixels
                const mmPx = (bgSettings.scale / 5) * (ruler.scaleFactor || 1.0);
                const totalWidth = ruler.lengthCm * 10 * mmPx;
                const rulerHeightPx = 60;

                // Transform point into ruler's local space (rotate by -angle)
                const dx = canvasX - ruler.x;
                const dy = canvasY - ruler.y;
                const rad = (ruler.angle * Math.PI) / 180;
                const cosA = Math.cos(rad);
                const sinA = Math.sin(rad);

                // Local coords (x along ruler, y perpendicular)
                const lx = dx * cosA + dy * sinA;
                const ly = -dx * sinA + dy * cosA;

                // Only consider if within ruler length bounds (with small margin)
                const margin = 8 / boardData.zoom;
                if (lx >= -margin && lx <= totalWidth + margin) {
                    const clampedLx = Math.max(0, Math.min(totalWidth, lx));

                    // Top edge: ly ≈ 0
                    const distTop = Math.abs(ly);
                    if (distTop < minDist) {
                        minDist = distTop;
                        // Back-transform snapped point to canvas coords
                        bestSnap = {
                            x: ruler.x + clampedLx * cosA,
                            y: ruler.y + clampedLx * sinA,
                            isSnapped: true,
                        };
                    }

                    // Bottom edge: ly ≈ rulerHeightPx
                    const distBottom = Math.abs(ly - rulerHeightPx);
                    if (distBottom < minDist) {
                        minDist = distBottom;
                        bestSnap = {
                            x: ruler.x + clampedLx * cosA - rulerHeightPx * sinA,
                            y: ruler.y + clampedLx * sinA + rulerHeightPx * cosA,
                            isSnapped: true,
                        };
                    }
                }
            }
        }

        if (hasSetSquares) {
            for (const setSquare of boardData.setSquares) {
                const sx = setSquare.flipX ? -1 : 1;
                const sy = setSquare.flipY ? -1 : 1;
                const mmPx = (bgSettings.scale / 5) * (setSquare.scaleFactor || 1.0);
                const legPx = setSquare.legCm * 10 * mmPx;
                const margin = 8 / boardData.zoom;

                const rad = (setSquare.angle * Math.PI) / 180;
                const cosA = Math.cos(rad);
                const sinA = Math.sin(rad);

                // (setSquare.x, setSquare.y) is the SVG body top-left (container CSS origin).
                // The right-angle corner is at CSS (originX, originY) within the container.
                // After rotation by angle around CSS (0,0), the right-angle corner's canvas
                // position is the container origin + rotate(originVec, angle):
                const originX = -Math.min(0, sx * legPx) + 30;
                const originY = -Math.min(0, -sy * legPx) + 30;
                const rightAngleX = setSquare.x + originX * cosA - originY * sinA;
                const rightAngleY = setSquare.y + originX * sinA + originY * cosA;

                // Transform cursor into local space relative to the right-angle corner
                const dx = canvasX - rightAngleX;
                const dy = canvasY - rightAngleY;
                const lx = dx * cosA + dy * sinA;
                const ly = -dx * sinA + dy * cosA;

                // Leg 1 (Horizontal: Y = 0, X between 0 and sx * legPx)
                const u1 = lx / sx;
                if (u1 >= -margin && u1 <= legPx + margin) {
                    const clampedU1 = Math.max(0, Math.min(legPx, u1));
                    const distLeg1 = Math.abs(ly);
                    if (distLeg1 < minDist) {
                        minDist = distLeg1;
                        const lxSnap = sx * clampedU1;
                        const lySnap = 0;
                        bestSnap = {
                            x: rightAngleX + lxSnap * cosA - lySnap * sinA,
                            y: rightAngleY + lxSnap * sinA + lySnap * cosA,
                            isSnapped: true,
                        };
                    }
                }

                // Leg 2 (Vertical: X = 0, Y between 0 and -sy * legPx)
                const u2 = ly / (-sy);
                if (u2 >= -margin && u2 <= legPx + margin) {
                    const clampedU2 = Math.max(0, Math.min(legPx, u2));
                    const distLeg2 = Math.abs(lx);
                    if (distLeg2 < minDist) {
                        minDist = distLeg2;
                        const lxSnap = 0;
                        const lySnap = -sy * clampedU2;
                        bestSnap = {
                            x: rightAngleX + lxSnap * cosA - lySnap * sinA,
                            y: rightAngleY + lxSnap * sinA + lySnap * cosA,
                            isSnapped: true,
                        };
                    }
                }

                // Hypotenuse: connects (sx * legPx, 0) to (0, -sy * legPx)
                const hypLength = legPx * Math.SQRT2;
                const distHyp = Math.abs(sy * lx - sx * ly - sx * sy * legPx) / Math.SQRT2;
                const t = (legPx - sx * lx - sy * ly) / Math.SQRT2;
                if (t >= -margin && t <= hypLength + margin) {
                    if (distHyp < minDist) {
                        minDist = distHyp;
                        const clampedT = Math.max(0, Math.min(hypLength, t));
                        const lxSnap = sx * legPx - (clampedT * sx) / Math.SQRT2;
                        const lySnap = (-clampedT * sy) / Math.SQRT2;
                        bestSnap = {
                            x: rightAngleX + lxSnap * cosA - lySnap * sinA,
                            y: rightAngleY + lxSnap * sinA + lySnap * cosA,
                            isSnapped: true,
                        };
                    }
                }
            }
        }

        if (hasProtractors) {
            for (const protractor of boardData.protractors) {
                const mmPx = (bgSettings.scale / 5) * (protractor.scaleFactor || 1.0);
                const radiusPx = protractor.radiusCm * 10 * mmPx;
                const margin = 8 / boardData.zoom;

                const rad = (protractor.angle * Math.PI) / 180;
                const cosA = Math.cos(rad);
                const sinA = Math.sin(rad);

                const dx = canvasX - protractor.x;
                const dy = canvasY - protractor.y;

                const lx = dx * cosA + dy * sinA;
                const ly = -dx * sinA + dy * cosA;

                if (lx >= -radiusPx - margin && lx <= radiusPx + margin) {
                    const distBaseline = Math.abs(ly);
                    if (distBaseline < minDist) {
                        minDist = distBaseline;
                        const clampedLx = Math.max(-radiusPx, Math.min(radiusPx, lx));
                        bestSnap = {
                            x: protractor.x + clampedLx * cosA,
                            y: protractor.y + clampedLx * sinA,
                            isSnapped: true,
                        };
                    }
                }
            }
        }

        if (hasCompasses) {
            for (const compass of boardData.compasses) {
                const mmPx = (bgSettings.scale / 5) * (compass.scaleFactor || 1.0);
                const radiusPx = compass.radiusCm * 10 * mmPx;

                const dx = canvasX - compass.x;
                const dy = canvasY - compass.y;
                const distToCenter = Math.hypot(dx, dy);

                // Snap to needle center point
                if (distToCenter < minDist && distToCenter < 18 / boardData.zoom) {
                    minDist = distToCenter;
                    bestSnap = {
                        x: compass.x,
                        y: compass.y,
                        isSnapped: true,
                    };
                }

                // Snap to circle perimeter arc
                const distToArc = Math.abs(distToCenter - radiusPx);
                if (distToArc < minDist && distToCenter > 5) {
                    minDist = distToArc;
                    const angle = Math.atan2(dy, dx);
                    bestSnap = {
                        x: compass.x + radiusPx * Math.cos(angle),
                        y: compass.y + radiusPx * Math.sin(angle),
                        isSnapped: true,
                    };
                }
            }
        }

        return bestSnap ?? { x: canvasX, y: canvasY, isSnapped: false };
    }

    // Математика кліку мишкою по лінії (для поодинокого виділення)
    function isPointNearLine(px, py, line) {
        if (line.tool === "shape" || line.tool === "text") {
            const bb = getBoundingBox(line);
            // Фіксований threshold для shape/text, не залежить від width
            const threshold = Math.max(8, line.width || 0) / boardData.zoom;
            return (
                px >= bb.minX - threshold &&
                px <= bb.maxX + threshold &&
                py >= bb.minY - threshold &&
                py <= bb.maxY + threshold
            );
        }

        // px, py вже мають бути в координатах канвасу
        const threshold = ((line.width || 2) + 10) / boardData.zoom;
        for (let i = 0; i < line.points.length - 1; i++) {
            const p1 = line.points[i];
            const p2 = line.points[i + 1];
            const A = px - p1.x;
            const B = py - p1.y;
            const C = p2.x - p1.x;
            const D = p2.y - p1.y;
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = lenSq !== 0 ? dot / lenSq : -1;
            let xx, yy;
            if (param < 0) {
                xx = p1.x;
                yy = p1.y;
            } else if (param > 1) {
                xx = p2.x;
                yy = p2.y;
            } else {
                xx = p1.x + param * C;
                yy = p1.y + param * D;
            }
            if (Math.sqrt((px - xx) ** 2 + (py - yy) ** 2) < threshold)
                return true;
        }
        return false;
    }

    function handlePointerDown(e) {
        if (boardData.isPdfMode) {
            if (
                e.button === 1 ||
                e.button === 2 ||
                brushSettings.tool === "move"
            ) {
                activePointers.set(e.pointerId, e);
                try {
                    e.target.setPointerCapture(e.pointerId);
                } catch (err) {
                    console.error("Failed to set pointer capture", err);
                }
                const rect = canvas.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;
                isPanning = true;
            }
            return;
        }

        activePointers.set(e.pointerId, e);

        // Якщо маємо 2 активних вказівника (пальці), активуємо жест масштабування/панорамування
        if (activePointers.size === 2) {
            isTwoFingerGesturing = true;
            isDrawing = false;
            isPanning = false;
            isSelectingArea = false;
            isMoving = false;

            // Якщо ми почали малювати лінію першим пальцем — видаляємо її,
            // оскільки користувач перейшов до жесту двома пальцями
            if (currentLineId) {
                boardData.lines = boardData.lines.filter(
                    (l) => l.id !== currentLineId,
                );
                currentLineId = null;
            }

            const pointers = Array.from(activePointers.values());
            const p1 = pointers[0];
            const p2 = pointers[1];
            const dx = p2.clientX - p1.clientX;
            const dy = p2.clientY - p1.clientY;
            initialTouchDistance = Math.sqrt(dx * dx + dy * dy);
            initialTouchCenter = {
                x: (p1.clientX + p2.clientX) / 2,
                y: (p1.clientY + p2.clientY) / 2,
            };
            initialZoom = boardData.zoom;
            initialOffsetX = boardData.offsetX;
            initialOffsetY = boardData.offsetY;
            redraw();
            return;
        }

        if (activePointers.size > 2) {
            // Ігноруємо дотик третього і більше пальців
            return;
        }

        // Захоплюємо вказівник, щоб отримувати події руху навіть поза межами канвасу
        try {
            e.target.setPointerCapture(e.pointerId);
        } catch (err) {
            console.error("Failed to set pointer capture", err);
        }

        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Конвертуємо в координати канвасу
        const canvasPos = toCanvas(screenX, screenY);

        startX = screenX; // Для рамки виділення та панорамування використовуємо екранні
        startY = screenY;
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (e.button === 1 || e.button === 2 || brushSettings.tool === "move") {
            // Середня, права кнопка або інструмент "move" — панорамування
            isPanning = true;
            return;
        }

        if (isCopying) {
            finalizeCopy();
            return;
        }

        if (brushSettings.tool === "text") {
            if (textInputState.active) {
                commitTextInput();
            } else {
                textInputState = {
                    active: true,
                    isEditing: false,
                    id: Date.now() + Math.random(),
                    x: screenX,
                    y: screenY,
                    canvasX: canvasPos.x,
                    canvasY: canvasPos.y,
                    text: "",
                    color: brushSettings.color,
                    fontSize: 24 / boardData.zoom,
                };
                setTimeout(() => {
                    if (textInputRef) textInputRef.focus();
                }, 10);
            }
            return;
        }

        if (textInputState.active) {
            commitTextInput();
        }

        showMenu = false; // Ховаємо меню при будь-якому новому кліку
        saveState();

        if (brushSettings.tool === "select") {
            // Перевіряємо чи клікнули на маркер ресайзу
            if (boardData.selectedLineIds.length === 1) {
                const selectedLine = boardData.lines.find(
                    (l) => l.id === boardData.selectedLineIds[0],
                );
                if (selectedLine) {
                    const bb = getBoundingBox(selectedLine);
                    const handles = getResizeHandles(bb);
                    let clickedHandle = null;
                    for (const h of handles) {
                        if (
                            canvasPos.x >= h.rect[0] &&
                            canvasPos.x <= h.rect[0] + h.rect[2] &&
                            canvasPos.y >= h.rect[1] &&
                            canvasPos.y <= h.rect[1] + h.rect[3]
                        ) {
                            clickedHandle = h;
                            break;
                        }
                    }
                    if (clickedHandle) {
                        isResizing = true;
                        activeResizeHandle = clickedHandle.id;
                        resizeOriginalLine = JSON.parse(
                            JSON.stringify(selectedLine),
                        );
                        resizeOriginalBB = bb;
                        startX = screenX;
                        startY = screenY;
                        return; // Зупиняємо подальшу обробку
                    }
                }
            }

            // Перевіряємо, чи клікнули ми по якійсь лінії
            let clickedLine = null;
            for (let i = boardData.lines.length - 1; i >= 0; i--) {
                if (
                    isPointNearLine(
                        canvasPos.x,
                        canvasPos.y,
                        boardData.lines[i],
                    )
                ) {
                    clickedLine = boardData.lines[i];
                    break;
                }
            }

            if (clickedLine) {
                if (!boardData.selectedLineIds.includes(clickedLine.id)) {
                    boardData.selectedLineIds = [clickedLine.id];
                }
                isMoving = true;
            } else {
                boardData.selectedLineIds = [];
                isSelectingArea = true;
                currentX = screenX;
                currentY = screenY;
            }
            redraw();
        } else {
            isDrawing = true;
            boardData.selectedLineIds = [];

            const id = Date.now() + Math.random();
            currentLineId = id;

            // Прилипаємо до лінійки якщо олівець поруч
            const snap0 = snapToRuler(canvasPos.x, canvasPos.y);
            const startPoint = snap0.isSnapped
                ? { x: snap0.x, y: snap0.y }
                : { x: canvasPos.x, y: canvasPos.y };

            boardData.lines = [
                ...boardData.lines,
                {
                    id: id,
                    color: brushSettings.color,
                    width: brushSettings.width,
                    tool: brushSettings.tool,
                    shapeType: brushSettings.shapeType,
                    points: [startPoint],
                },
            ];
            redraw();
        }
    }

    function handlePointerMove(e) {
        if (activePointers.has(e.pointerId)) {
            activePointers.set(e.pointerId, e);
        }

        // Якщо ми в режимі жестів двома пальцями — оновлюємо зум і зсув
        if (isTwoFingerGesturing && activePointers.size >= 2) {
            const pointers = Array.from(activePointers.values());
            const p1 = pointers[0];
            const p2 = pointers[1];
            const dx = p2.clientX - p1.clientX;
            const dy = p2.clientY - p1.clientY;
            const currentDistance = Math.sqrt(dx * dx + dy * dy);
            const currentCenter = {
                x: (p1.clientX + p2.clientX) / 2,
                y: (p1.clientY + p2.clientY) / 2,
            };

            let newZoom = initialZoom;
            if (initialTouchDistance > 0) {
                newZoom =
                    initialZoom * (currentDistance / initialTouchDistance);
            }
            newZoom = Math.max(0.1, Math.min(10, newZoom));
            boardData.zoom = newZoom;

            // Зсув вираховується так, щоб точка на канвасі під початковим центром жестів
            // залишалася під поточним центром дотиків пальців
            const centerCanvasX =
                (initialTouchCenter.x - initialOffsetX) / initialZoom;
            const centerCanvasY =
                (initialTouchCenter.y - initialOffsetY) / initialZoom;

            boardData.offsetX =
                currentCenter.x - centerCanvasX * boardData.zoom;
            boardData.offsetY =
                currentCenter.y - centerCanvasY * boardData.zoom;

            redraw();
            return;
        }

        // Якщо жест двома пальцями був активний, але зараз залишився лише один палець,
        // ми не хочемо малювати поодиноким пальцем до повного відпускання екрану.
        if (isTwoFingerGesturing) {
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const canvasPos = toCanvas(screenX, screenY);

        mouseX = e.clientX;
        mouseY = e.clientY;
        showCursor = true;

        // Встановлення курсора для маркерів ресайзу та hover-підсвічування
        if (
            brushSettings.tool === "select" &&
            !isResizing &&
            !isMoving &&
            !isSelectingArea
        ) {
            let foundHandle = null;

            // Перевіряємо маркери ресайзу для одиничного виділення
            if (boardData.selectedLineIds.length === 1) {
                const selectedLine = boardData.lines.find(
                    (l) => l.id === boardData.selectedLineIds[0],
                );
                if (selectedLine) {
                    const bb = getBoundingBox(selectedLine);
                    const handles = getResizeHandles(bb);
                    for (const h of handles) {
                        if (
                            canvasPos.x >= h.rect[0] &&
                            canvasPos.x <= h.rect[0] + h.rect[2] &&
                            canvasPos.y >= h.rect[1] &&
                            canvasPos.y <= h.rect[1] + h.rect[3]
                        ) {
                            foundHandle = h;
                            break;
                        }
                    }
                }
            }

            if (foundHandle) {
                resizeCursor = foundHandle.cursor;
                hoverLineId = null;
            } else {
                resizeCursor = "default";
                // Перевіряємо hover над будь-яким об'єктом для курсора "move"
                let hoveredLine = null;
                for (let i = boardData.lines.length - 1; i >= 0; i--) {
                    if (
                        isPointNearLine(
                            canvasPos.x,
                            canvasPos.y,
                            boardData.lines[i],
                        )
                    ) {
                        hoveredLine = boardData.lines[i];
                        break;
                    }
                }
                hoverLineId = hoveredLine ? hoveredLine.id : null;
            }
        } else if (!isResizing) {
            resizeCursor = "default";
            if (!isMoving) hoverLineId = null;
        }

        if (isPanning) {
            boardData.offsetX += screenX - startX;
            boardData.offsetY += screenY - startY;
            startX = screenX;
            startY = screenY;
            redraw();
        } else if (isDrawing && currentLineId) {
            // Перевіряємо чи потрібно прилипнути до лінійки
            const snap = snapToRuler(canvasPos.x, canvasPos.y);
            const drawX = snap.isSnapped ? snap.x : canvasPos.x;
            const drawY = snap.isSnapped ? snap.y : canvasPos.y;

            boardData.lines = boardData.lines.map((line) => {
                if (line.id === currentLineId) {
                    if (line.tool === "shape") {
                        const newPoints = [...line.points];
                        if (newPoints.length === 1) {
                            newPoints.push({ x: drawX, y: drawY });
                        } else {
                            newPoints[1] = { x: drawX, y: drawY };
                        }
                        return { ...line, points: newPoints };
                    } else {
                        return {
                            ...line,
                            points: [
                                ...line.points,
                                { x: drawX, y: drawY },
                            ],
                        };
                    }
                }
                return line;
            });
            redraw();
        } else if (isSelectingArea) {
            currentX = screenX;
            currentY = screenY;
            redraw();
        } else if (isMoving && boardData.selectedLineIds.length > 0) {
            const dx = (screenX - startX) / boardData.zoom;
            const dy = (screenY - startY) / boardData.zoom;

            boardData.lines = boardData.lines.map((line) => {
                if (boardData.selectedLineIds.includes(line.id)) {
                    return {
                        ...line,
                        points: line.points.map((p) => ({
                            x: p.x + dx,
                            y: p.y + dy,
                        })),
                    };
                }
                return line;
            });

            startX = screenX;
            startY = screenY;
            redraw();
        } else if (isResizing && boardData.selectedLineIds.length === 1) {
            const dx = (screenX - startX) / boardData.zoom;
            const dy = (screenY - startY) / boardData.zoom;

            let newMinX = resizeOriginalBB.minX;
            let newMinY = resizeOriginalBB.minY;
            let newMaxX = resizeOriginalBB.maxX;
            let newMaxY = resizeOriginalBB.maxY;

            if (activeResizeHandle.includes("w")) newMinX += dx;
            if (activeResizeHandle.includes("e")) newMaxX += dx;
            if (activeResizeHandle.includes("n")) newMinY += dy;
            if (activeResizeHandle.includes("s")) newMaxY += dy;

            // Запобігаємо вивертанню навиворіт (від'ємному розміру)
            if (newMinX > newMaxX - 1) {
                if (activeResizeHandle.includes("w")) newMinX = newMaxX - 1;
                else newMaxX = newMinX + 1;
            }
            if (newMinY > newMaxY - 1) {
                if (activeResizeHandle.includes("n")) newMinY = newMaxY - 1;
                else newMaxY = newMinY + 1;
            }

            const oldW = resizeOriginalBB.maxX - resizeOriginalBB.minX;
            const oldH = resizeOriginalBB.maxY - resizeOriginalBB.minY;
            const newW = newMaxX - newMinX;
            const newH = newMaxY - newMinY;

            const scaleX = oldW === 0 ? 1 : newW / oldW;
            const scaleY = oldH === 0 ? 1 : newH / oldH;

            boardData.lines = boardData.lines.map((line) => {
                if (line.id === boardData.selectedLineIds[0]) {
                    const scaledLine = { ...resizeOriginalLine };

                    if (scaledLine.tool === "text") {
                        scaledLine.points = [
                            {
                                x:
                                    newMinX +
                                    (resizeOriginalLine.points[0].x -
                                        resizeOriginalBB.minX) *
                                        scaleX,
                                y:
                                    newMinY +
                                    (resizeOriginalLine.points[0].y -
                                        resizeOriginalBB.minY) *
                                        scaleY,
                            },
                        ];
                        scaledLine.fontSize =
                            (resizeOriginalLine.fontSize || 24) * scaleY;
                        if (scaledLine.fontSize < 5) scaledLine.fontSize = 5;
                    } else {
                        scaledLine.points = resizeOriginalLine.points.map(
                            (p) => ({
                                x:
                                    newMinX +
                                    (p.x - resizeOriginalBB.minX) * scaleX,
                                y:
                                    newMinY +
                                    (p.y - resizeOriginalBB.minY) * scaleY,
                            }),
                        );
                    }
                    return scaledLine;
                }
                return line;
            });
            redraw();
        } else if (isCopying) {
            redraw();
        }
    }

    function handlePointerUp(e) {
        activePointers.delete(e.pointerId);

        const wasTwoFingerGesturing = isTwoFingerGesturing;

        if (activePointers.size < 2) {
            isTwoFingerGesturing = false;
        }

        // Якщо ми завершили жест двома пальцями (або все ще відпускаємо пальці),
        // ми просто ігноруємо решту дій, поки екран повністю не очиститься від дотиків.
        if (wasTwoFingerGesturing) {
            return;
        }

        if (isSelectingArea) {
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;

            let newlySelected = [];
            boardData.lines.forEach((line) => {
                if (
                    isLineInSelectArea(startX, startY, screenX, screenY, line)
                ) {
                    newlySelected.push(line.id);
                }
            });

            boardData.selectedLineIds = newlySelected;
            redraw();
        }

        const wasSelecting = isSelectingArea;
        const wasMoving = isMoving;
        const wasResizing = isResizing;

        isDrawing = false;
        isMoving = false;
        isPanning = false;
        isSelectingArea = false;
        isResizing = false;
        currentLineId = null;
        activeResizeHandle = null;
        resizeOriginalLine = null;
        resizeOriginalBB = null;

        // Показуємо меню тільки якщо ми завершили виділення (рамкою або кліком)
        // і при цьому НЕ переміщували об'єкти (щоб меню не "стрибало" після кожного перетягування)
        if (
            boardData.selectedLineIds.length > 0 &&
            !isCopying &&
            !textInputState.active &&
            (wasSelecting ||
                (wasMoving && !showMenu) ||
                (wasResizing && !showMenu))
        ) {
            showMenu = true;
            menuPos = { x: e.clientX, y: e.clientY };
        }
    }

    function handleDblClick(e) {
        if (brushSettings.tool !== "select") return;
        if (textInputState.active) return;

        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const canvasPos = toCanvas(screenX, screenY);

        // Шукаємо text-об'єкт під курсором
        for (let i = boardData.lines.length - 1; i >= 0; i--) {
            const line = boardData.lines[i];
            if (
                line.tool === "text" &&
                isPointNearLine(canvasPos.x, canvasPos.y, line)
            ) {
                openTextEdit(line);
                return;
            }
        }
    }

    function handleDelete() {
        if (boardData.selectedLineIds.length === 0) return;
        saveState();
        boardData.lines = boardData.lines.filter(
            (line) => !boardData.selectedLineIds.includes(line.id),
        );
        boardData.selectedLineIds = [];
        showMenu = false;
        redraw();
    }

    function handleCopy() {
        if (boardData.selectedLineIds.length === 0) return;

        const selectedLines = boardData.lines.filter((line) =>
            boardData.selectedLineIds.includes(line.id),
        );

        // Створюємо глибокі копії
        copiedLines = selectedLines.map((line) => ({
            ...line,
            id: Date.now() + Math.random(),
            points: line.points.map((p) => ({ ...p })),
        }));

        const canvasPos = toCanvas(mouseX, mouseY);
        copyOrigin = { x: canvasPos.x, y: canvasPos.y };
        isCopying = true;
        showMenu = false;
        boardData.selectedLineIds = []; // Знімаємо виділення з оригіналів
        redraw();
    }

    function finalizeCopy() {
        if (!isCopying) return;

        const canvasPos = toCanvas(mouseX, mouseY);
        const dx = canvasPos.x - copyOrigin.x;
        const dy = canvasPos.y - copyOrigin.y;

        const linesToPaste = copiedLines.map((line) => ({
            ...line,
            points: line.points.map((p) => ({
                x: p.x + dx,
                y: p.y + dy,
            })),
        }));

        saveState();
        boardData.lines = [...boardData.lines, ...linesToPaste];
        isCopying = false;
        copiedLines = [];
        redraw();
    }
</script>

<canvas
    bind:this={canvas}
    class={brushSettings.tool}
    class:panning={isPanning}
    class:hovering={brushSettings.tool === "select" &&
        hoverLineId !== null &&
        resizeCursor === "default"}
    style={brushSettings.tool === "select" && resizeCursor !== "default"
        ? `cursor: ${resizeCursor} !important;`
        : ""}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    ondblclick={handleDblClick}
    onpointerenter={(e) => {
        showCursor = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
    }}
    onpointerleave={(e) => {
        handlePointerUp(e);
        showCursor = false;
    }}
    oncontextmenu={(e) => e.preventDefault()}
></canvas>

{#if showCursor && (brushSettings.tool === "brush" || brushSettings.tool === "eraser")}
    <div
        class="custom-cursor"
        style="
            left: {mouseX}px; 
            top: {mouseY}px; 
            width: {brushSettings.width * boardData.zoom}px; 
            height: {brushSettings.width * boardData.zoom}px;
            background-color: {brushSettings.tool === 'eraser'
            ? 'rgba(255, 255, 255, 0.3)'
            : brushSettings.color};
            border: 1px solid {brushSettings.tool === 'eraser'
            ? '#000'
            : 'rgba(0,0,0,0.2)'};
        "
    ></div>
{/if}

{#if showMenu && !isCopying}
    {@const selectedLine = boardData.lines.find(
        (l) => l.id === boardData.selectedLineIds[0],
    )}
    <SelectionMenu
        x={menuPos.x}
        y={menuPos.y}
        onCopy={handleCopy}
        onDelete={handleDelete}
        isText={boardData.selectedLineIds.length === 1 &&
            selectedLine?.tool === "text"}
        onEdit={() => {
            if (selectedLine) openTextEdit(selectedLine);
        }}
    />
{/if}

{#if textInputState.active}
    <textarea
        bind:this={textInputRef}
        bind:value={textInputState.text}
        onblur={commitTextInput}
        onkeydown={(e) => {
            if (e.key === "Escape") {
                textInputState.active = false;
                redraw();
            }
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitTextInput();
            }
        }}
        rows="1"
        style="
            position: absolute;
            left: {textInputState.x}px;
            top: {textInputState.y}px;
            color: {textInputState.color};
            font-size: {textInputState.fontSize * boardData.zoom}px;
            font-family: sans-serif;
            background: rgba(255,255,255,0.92);
            border: 1.5px dashed #007bff;
            border-radius: 4px;
            outline: none;
            padding: 2px 6px;
            margin: 0;
            z-index: 1000;
            min-width: 80px;
            resize: none;
            overflow: hidden;
            line-height: 1.2;
            box-shadow: 0 2px 8px rgba(0,123,255,0.15);
        "
        oninput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
            e.target.style.width = "auto";
            e.target.style.width = Math.max(80, e.target.scrollWidth) + "px";
        }}
    ></textarea>
{/if}

<style>
    canvas {
        background: #ffffff;
        display: block;
        touch-action: none;
    }

    canvas.brush,
    canvas.eraser {
        cursor: none;
    }

    canvas.select {
        cursor: default;
    }

    canvas.select.hovering {
        cursor: move;
    }

    canvas.move {
        cursor: grab;
    }

    canvas.panning {
        cursor: grabbing !important;
    }

    .custom-cursor {
        position: fixed;
        pointer-events: none;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        z-index: 9999;
    }
</style>
