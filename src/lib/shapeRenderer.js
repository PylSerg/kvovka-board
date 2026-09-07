const FILLABLE_2D_SHAPES = new Set([
    "circle",
    "square",
    "ellipse",
    "rectangle",
    "triangle",
    "equilateral_triangle",
    "right_triangle",
    "trapezoid",
    "parallelogram",
]);

function fillPolygon(ctx, points) {
    if (!points || points.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
}

export function drawShape(ctx, shapeObj) {
    if (!shapeObj.points || shapeObj.points.length < 2) return;

    const p1 = shapeObj.points[0];
    const p2 = shapeObj.points[shapeObj.points.length - 1]; // Завжди беремо першу і останню точку

    ctx.beginPath();
    ctx.lineWidth = shapeObj.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = shapeObj.color;

    const isEraseStroke = shapeObj.tool === "eraser" || shapeObj.color === "#ffffff";
    const fillColor = shapeObj.fillColor || null;
    const shouldFill = Boolean(fillColor);
    const fillClosedPath = shouldFill && FILLABLE_2D_SHAPES.has(shapeObj.shapeType);

    // Білий контур працює як гумка. Якщо є заливка — спочатку малюємо її поверх дошки.
    if (isEraseStroke && !shouldFill) {
        ctx.globalCompositeOperation = "destination-out";
    } else {
        ctx.globalCompositeOperation = "source-over";
    }

    if (shapeObj.shapeType === 'dashed_line') {
        ctx.setLineDash([10, 10]);
    } else {
        ctx.setLineDash([]);
    }

    const minX = Math.min(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxX = Math.max(p1.x, p2.x);
    const maxY = Math.max(p1.y, p2.y);
    const width = maxX - minX;
    const height = maxY - minY;

    // Деякі фігури (наприклад, пропорційні) вимагають квадратних меж
    const size = Math.max(width, height);
    const cx = minX + width / 2;
    const cy = minY + height / 2;

    switch (shapeObj.shapeType) {
        case 'line':
        case 'dashed_line':
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            break;

        case 'arrow':
            const headlen = 15 + shapeObj.width; // Довжина стрілки
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const angle = Math.atan2(dy, dx);
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p2.x - headlen * Math.cos(angle - Math.PI / 6), p2.y - headlen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(p2.x - headlen * Math.cos(angle + Math.PI / 6), p2.y - headlen * Math.sin(angle + Math.PI / 6));
            break;

        case 'rectangle':
            ctx.rect(minX, minY, width, height);
            break;

        case 'square':
            // Квадрат від точки кліку
            const sqSide = Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
            const sx = p2.x < p1.x ? p1.x - sqSide : p1.x;
            const sy = p2.y < p1.y ? p1.y - sqSide : p1.y;
            ctx.rect(sx, sy, sqSide, sqSide);
            break;

        case 'ellipse':
            ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, 2 * Math.PI);
            break;

        case 'circle':
            const radius = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            ctx.arc(p1.x, p1.y, radius, 0, 2 * Math.PI);
            break;

        case 'triangle':
            ctx.moveTo(cx, minY);
            ctx.lineTo(maxX, maxY);
            ctx.lineTo(minX, maxY);
            ctx.closePath();
            break;

        case 'equilateral_triangle':
            const eqSide = Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
            const eh = eqSide * Math.sqrt(3) / 2;
            ctx.moveTo(p1.x, p1.y - eh);
            ctx.lineTo(p1.x - eqSide / 2, p1.y + eh / 2);
            ctx.lineTo(p1.x + eqSide / 2, p1.y + eh / 2);
            ctx.closePath();
            break;

        case 'right_triangle':
            const rtx = p2.x < p1.x ? minX : maxX;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p1.x, p2.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.closePath();
            break;

        case 'trapezoid':
            const offset = width * 0.25;
            ctx.moveTo(minX + offset, minY);
            ctx.lineTo(maxX - offset, minY);
            ctx.lineTo(maxX, maxY);
            ctx.lineTo(minX, maxY);
            ctx.closePath();
            break;

        case 'parallelogram':
            const poffset = width * 0.25;
            ctx.moveTo(minX + poffset, minY);
            ctx.lineTo(maxX, minY);
            ctx.lineTo(maxX - poffset, maxY);
            ctx.lineTo(minX, maxY);
            ctx.closePath();
            break;

        case 'sphere': {
            const sRadius = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            if (sRadius < 1) break;
            const sPerspective = 0.3; // сплющення еліпса по вертикалі (перспектива)

            if (shouldFill) {
                ctx.fillStyle = fillColor;
                ctx.beginPath();
                ctx.arc(p1.x, p1.y, sRadius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.beginPath();
            }

            // 1. Зовнішне коло + екватор (суцільна передня частина)
            ctx.arc(p1.x, p1.y, sRadius, 0, 2 * Math.PI);
            ctx.moveTo(p1.x - sRadius, p1.y);
            ctx.ellipse(p1.x, p1.y, sRadius, sRadius * sPerspective, 0, Math.PI, 2 * Math.PI);
            ctx.stroke();

            // 2. Екватор — задня (хована) половина
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.ellipse(p1.x, p1.y, sRadius, sRadius * sPerspective, 0, 0, Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);

            // 3. Верхня паралель (џ 45°)
            const latN = sRadius * 0.65;
            const rN = Math.sqrt(sRadius ** 2 - latN ** 2);
            ctx.beginPath();
            ctx.moveTo(p1.x - rN, p1.y - latN);
            ctx.ellipse(p1.x, p1.y - latN, rN, rN * sPerspective, 0, Math.PI, 2 * Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.ellipse(p1.x, p1.y - latN, rN, rN * sPerspective, 0, 0, Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);

            // 4. Нижня паралель (џ -45°)
            ctx.beginPath();
            ctx.moveTo(p1.x - rN, p1.y + latN);
            ctx.ellipse(p1.x, p1.y + latN, rN, rN * sPerspective, 0, Math.PI, 2 * Math.PI);
            ctx.stroke();
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.ellipse(p1.x, p1.y + latN, rN, rN * sPerspective, 0, 0, Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);

            // 5. Вертикальний мерідіан — суцільна передня (rights) половина
            const mRx = sRadius * sPerspective;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y - sRadius);
            ctx.ellipse(p1.x, p1.y, mRx, sRadius, 0, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();

            // 6. Вертикальний мерідіан — хована ліва половина (фінальний stroke робить drawShape)
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(p1.x, p1.y + sRadius);
            ctx.ellipse(p1.x, p1.y, mRx, sRadius, 0, Math.PI / 2, (3 * Math.PI) / 2);
            break;
        }

        case 'cube': {
            const cubeSide = Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)) * 0.7;
            const cbx = p1.x;
            const cby = p1.y;
            const cdx = cubeSide * 0.4;
            const cdy = cubeSide * 0.4;
            const A = { x: cbx, y: cby };
            const B = { x: cbx + cubeSide, y: cby };
            const C = { x: cbx + cubeSide, y: cby + cubeSide };
            const D = { x: cbx, y: cby + cubeSide };
            const E = { x: cbx + cdx, y: cby - cdy };
            const F = { x: cbx + cubeSide + cdx, y: cby - cdy };
            const G = { x: cbx + cubeSide + cdx, y: cby + cubeSide - cdy };
            const H = { x: cbx + cdx, y: cby + cubeSide - cdy };

            if (shouldFill) {
                ctx.fillStyle = fillColor;
                fillPolygon(ctx, [E, F, G, H]); // задня
                fillPolygon(ctx, [D, C, G, H]); // нижня
                fillPolygon(ctx, [A, E, H, D]); // ліва
                fillPolygon(ctx, [B, F, G, C]); // права
                fillPolygon(ctx, [A, B, F, E]); // верхня
                fillPolygon(ctx, [A, B, C, D]); // передня
                ctx.beginPath();
            }

            ctx.rect(cbx, cby, cubeSide, cubeSide);
            ctx.rect(cbx + cdx, cby - cdy, cubeSide, cubeSide);
            ctx.moveTo(cbx, cby); ctx.lineTo(cbx + cdx, cby - cdy);
            ctx.moveTo(cbx + cubeSide, cby); ctx.lineTo(cbx + cubeSide + cdx, cby - cdy);
            ctx.moveTo(cbx + cubeSide, cby + cubeSide); ctx.lineTo(cbx + cubeSide + cdx, cby + cubeSide - cdy);
            ctx.moveTo(cbx, cby + cubeSide); ctx.lineTo(cbx + cdx, cby + cubeSide - cdy);
            break;
        }

        case 'parallelepiped': {
            const ppx = p1.x;
            const ppy = p1.y;
            const ppw = width * 0.7;
            const pph = height * 0.7;
            const pdx = width * 0.3;
            const pdy = height * 0.3;
            const A = { x: ppx, y: ppy };
            const B = { x: ppx + ppw, y: ppy };
            const C = { x: ppx + ppw, y: ppy + pph };
            const D = { x: ppx, y: ppy + pph };
            const E = { x: ppx + pdx, y: ppy - pdy };
            const F = { x: ppx + ppw + pdx, y: ppy - pdy };
            const G = { x: ppx + ppw + pdx, y: ppy + pph - pdy };
            const H = { x: ppx + pdx, y: ppy + pph - pdy };

            if (shouldFill) {
                ctx.fillStyle = fillColor;
                fillPolygon(ctx, [E, F, G, H]);
                fillPolygon(ctx, [D, C, G, H]);
                fillPolygon(ctx, [A, E, H, D]);
                fillPolygon(ctx, [B, F, G, C]);
                fillPolygon(ctx, [A, B, F, E]);
                fillPolygon(ctx, [A, B, C, D]);
                ctx.beginPath();
            }

            ctx.rect(ppx, ppy, ppw, pph);
            ctx.rect(ppx + pdx, ppy - pdy, ppw, pph);
            ctx.moveTo(ppx, ppy); ctx.lineTo(ppx + pdx, ppy - pdy);
            ctx.moveTo(ppx + ppw, ppy); ctx.lineTo(ppx + ppw + pdx, ppy - pdy);
            ctx.moveTo(ppx + ppw, ppy + pph); ctx.lineTo(ppx + ppw + pdx, ppy + pph - pdy);
            ctx.moveTo(ppx, ppy + pph); ctx.lineTo(ppx + pdx, ppy + pph - pdy);
            break;
        }

        case 'cylinder': {
            const cyw = width / 2;
            const cyh = height;
            const cyry = Math.min(cyw * 0.3, cyh * 0.2);

            if (shouldFill) {
                ctx.fillStyle = fillColor;
                ctx.beginPath();
                ctx.ellipse(cx, maxY - cyry, cyw, cyry, 0, 0, 2 * Math.PI);
                ctx.fill();
                ctx.fillRect(minX, minY + cyry, width, Math.max(0, height - 2 * cyry));
                ctx.beginPath();
                ctx.ellipse(cx, minY + cyry, cyw, cyry, 0, 0, 2 * Math.PI);
                ctx.fill();
                ctx.beginPath();
            }

            ctx.ellipse(cx, minY + cyry, cyw, cyry, 0, 0, 2 * Math.PI);
            ctx.moveTo(minX, minY + cyry);
            ctx.lineTo(minX, maxY - cyry);
            ctx.moveTo(maxX, minY + cyry);
            ctx.lineTo(maxX, maxY - cyry);

            ctx.moveTo(maxX, maxY - cyry);
            ctx.ellipse(cx, maxY - cyry, cyw, cyry, 0, 0, Math.PI);
            ctx.stroke();

            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.ellipse(cx, maxY - cyry, cyw, cyry, 0, Math.PI, 2 * Math.PI);
            break;
        }

        case 'cone': {
            const cow = width / 2;
            const coh = height;
            const cory = Math.min(cow * 0.3, coh * 0.2);

            if (shouldFill) {
                ctx.fillStyle = fillColor;
                ctx.beginPath();
                ctx.ellipse(cx, maxY - cory, cow, cory, 0, 0, 2 * Math.PI);
                ctx.fill();
                fillPolygon(ctx, [
                    { x: cx, y: minY },
                    { x: minX, y: maxY - cory },
                    { x: maxX, y: maxY - cory },
                ]);
                ctx.beginPath();
            }

            ctx.moveTo(cx, minY);
            ctx.lineTo(minX, maxY - cory);
            ctx.moveTo(cx, minY);
            ctx.lineTo(maxX, maxY - cory);

            ctx.moveTo(maxX, maxY - cory);
            ctx.ellipse(cx, maxY - cory, cow, cory, 0, 0, Math.PI);
            ctx.stroke();

            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.ellipse(cx, maxY - cory, cow, cory, 0, Math.PI, 2 * Math.PI);
            break;
        }

        case 'pyramid': {
            // Правильна чотирикутна піраміда з перспективною прямокутною основою
            const pDepth = width * 0.18; // горизонтальне зрушення для глибини
            const pRise = height * 0.22; // наскільки задні кути вище передніх

            const apex = { x: cx, y: minY }; // вершина
            const fl = { x: minX, y: maxY }; // передній-лівий
            const fr = { x: maxX, y: maxY }; // передній-правий
            const br = { x: maxX - pDepth, y: maxY - pRise }; // задній-правий (видимий)
            const bl = { x: minX + pDepth, y: maxY - pRise }; // задній-лівий  (хований)

            if (shouldFill) {
                ctx.fillStyle = fillColor;
                fillPolygon(ctx, [fl, fr, br, bl]);
                fillPolygon(ctx, [apex, bl, fl]);
                fillPolygon(ctx, [apex, bl, br]);
                fillPolygon(ctx, [apex, fr, br]);
                fillPolygon(ctx, [apex, fl, fr]);
                ctx.beginPath();
            }

            // Суцільні: ребра → всі 4 бічні ребра, видимі ребра основи
            ctx.moveTo(apex.x, apex.y); ctx.lineTo(fl.x, fl.y);   // ліва бічна грань
            ctx.moveTo(apex.x, apex.y); ctx.lineTo(fr.x, fr.y);   // права бічна грань
            ctx.moveTo(apex.x, apex.y); ctx.lineTo(br.x, br.y);   // задньо-права бічна грань
            ctx.moveTo(fl.x, fl.y); ctx.lineTo(fr.x, fr.y); // передня ребра основи
            ctx.moveTo(fr.x, fr.y); ctx.lineTo(br.x, br.y); // права ребра основи
            ctx.stroke();

            // Ховані: ребра вершина → задній-лівий, ліва і задня ребра основи
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(apex.x, apex.y); ctx.lineTo(bl.x, bl.y);   // задньо-ліва бічна грань
            ctx.moveTo(fl.x, fl.y); ctx.lineTo(bl.x, bl.y);   // ліва ребра основи
            ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);   // задня ребра основи
            break;
        }

        default:
            break;
    }

    if (fillClosedPath) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }

    if (isEraseStroke) {
        ctx.globalCompositeOperation = "destination-out";
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    // Відновлюємо налаштування ліній
    ctx.setLineDash([]);
}
