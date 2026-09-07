// src/lib/store.svelte.js

export const brushSettings = $state({
    color: '#000000',
    width: 5,
    tool: 'brush', // 'brush', 'eraser', 'select', 'move', 'shape', 'text'
    shapeType: 'rectangle', // default shape
    fillColor: null, // null = без заливки
});

// Масив усіх намальованих ліній
export const boardData = $state({
    lines: [],            // Кожна лінія: { id, color, width, points: [{x, y}] }
    selectedLineIds: [],  // <--- Тепер це масив для множинного виділення!
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    pdfFrames: [],        // Фрейми для експорту в PDF: { id, x, y, width, height, isVertical, number }
    isPdfMode: false,     // Чи активний режим налаштування фреймів PDF
    rulers: [],           // Лінійки: { id, x, y, angle, lengthCm, scaleFactor }
    setSquares: [],       // Косинці: { id, x, y, angle, legCm, scaleFactor, flipX, flipY }
    protractors: [],      // Транспортири: { id, x, y, angle, radiusCm, scaleFactor, flipY }
    compasses: [],        // Циркулі: { id, x, y, angle, radiusCm, scaleFactor }
    coordLines: [],       // Координатні прямі: { id, x, y, angle, minVal, maxVal, stepPx, scaleFactor, showNumbers, showArrows, axisLabel }
    coordPlanes2D: [],    // Координатні площини 2D: { id, x, y, angle, minX, maxX, minY, maxY, stepPx, scaleFactor, showGrid, showNumbers, showArrows, labelX, labelY }
    coordPlanes3D: []     // Координатні площини 3D: { id, x, y, angle, axisXAngle, axisXForeshortening, rangeX, rangeY, rangeZ, stepPx, scaleFactor, showNegativeAxes, showPlanes, showNumbers, labelX, labelY, labelZ }
});

export function addCoordLine() {
    const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
    const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
    const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;

    const newCoordLine = {
        id: Date.now() + Math.random(),
        x: canvasX,
        y: canvasY,
        angle: 0,
        minVal: -5,
        maxVal: 5,
        stepPx: 40,
        scaleFactor: 1.0,
        showNumbers: true,
        showArrows: 'positive',
        axisLabel: 'x'
    };
    boardData.coordLines = [...(boardData.coordLines || []), newCoordLine];
}

export function deleteCoordLine(id) {
    if (boardData.coordLines) {
        boardData.coordLines = boardData.coordLines.filter(c => c.id !== id);
    }
}

export function addCoordPlane2D() {
    const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
    const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
    const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;

    const newCoordPlane = {
        id: Date.now() + Math.random(),
        x: canvasX,
        y: canvasY,
        angle: 0,
        minX: -5,
        maxX: 5,
        minY: -5,
        maxY: 5,
        stepPx: 40,
        scaleFactor: 1.0,
        showGrid: true,
        showNumbers: true,
        showArrows: true,
        labelX: 'x',
        labelY: 'y'
    };
    boardData.coordPlanes2D = [...(boardData.coordPlanes2D || []), newCoordPlane];
}

export function deleteCoordPlane2D(id) {
    if (boardData.coordPlanes2D) {
        boardData.coordPlanes2D = boardData.coordPlanes2D.filter(p => p.id !== id);
    }
}

export function addCoordPlane3D() {
    const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
    const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
    const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;

    const newCoordPlane3D = {
        id: Date.now() + Math.random(),
        x: canvasX,
        y: canvasY,
        angle: 0,
        axisXAngle: 135,
        axisXForeshortening: 0.5,
        rangeX: 5,
        rangeY: 5,
        rangeZ: 5,
        stepPx: 40,
        scaleFactor: 1.0,
        showNegativeAxes: true,
        showPlanes: true,
        showNumbers: true,
        labelX: 'x',
        labelY: 'y',
        labelZ: 'z'
    };
    boardData.coordPlanes3D = [...(boardData.coordPlanes3D || []), newCoordPlane3D];
}

export function deleteCoordPlane3D(id) {
    if (boardData.coordPlanes3D) {
        boardData.coordPlanes3D = boardData.coordPlanes3D.filter(p => p.id !== id);
    }
}

export function addCompass() {
    const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
    const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
    const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;

    const newCompass = {
        id: Date.now() + Math.random(),
        x: canvasX,
        y: canvasY,
        angle: 0,
        radiusCm: 5.0,
        scaleFactor: 1.0
    };
    boardData.compasses = [...(boardData.compasses || []), newCompass];
}

export function deleteCompass(id) {
    if (boardData.compasses) {
        boardData.compasses = boardData.compasses.filter(c => c.id !== id);
    }
}

export function addRuler() {
    const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
    const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
    const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;

    const newRuler = {
        id: Date.now() + Math.random(),
        x: canvasX - 150,
        y: canvasY - 40,
        angle: 0,
        lengthCm: 10.5,
        scaleFactor: 1.0
    };
    boardData.rulers = [...(boardData.rulers || []), newRuler];
}

export function deleteRuler(id) {
    if (boardData.rulers) {
        boardData.rulers = boardData.rulers.filter(r => r.id !== id);
    }
}

export function addSetSquare() {
    const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
    const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
    const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;

    // Default parameters
    const legCm = 5.5;
    const scaleFactor = 1.0;
    const mmPx = (bgSettings.scale / 5) * scaleFactor;
    const legPx = legCm * 10 * mmPx;

    // The SVG viewBox starts at (minX, minY) = (-30, -legPx-30) relative to the
    // right-angle corner. So (setSquare.x, setSquare.y) is the SVG body top-left
    // (container CSS origin), and the right-angle corner lives at offset:
    //   originX = -minX = 30
    //   originY = -minY = legPx + 30
    // To place the right-angle corner at screen center, subtract the offset:
    const originX = 30;          // for default flipX=false (sx=1)
    const originY = legPx + 30;  // for default flipY=false (sy=1)

    const newSetSquare = {
        id: Date.now() + Math.random(),
        x: canvasX - originX,
        y: canvasY - originY,
        angle: 0,
        legCm,
        scaleFactor,
        flipX: false,
        flipY: false
    };
    boardData.setSquares = [...(boardData.setSquares || []), newSetSquare];
}

export function deleteSetSquare(id) {
    if (boardData.setSquares) {
        boardData.setSquares = boardData.setSquares.filter(s => s.id !== id);
    }
}

export function toggleFlipXSetSquare(id) {
    if (boardData.setSquares) {
        const sq = boardData.setSquares.find(s => s.id === id);
        if (sq) {
            sq.flipX = !sq.flipX;
            boardData.setSquares = [...boardData.setSquares];
        }
    }
}

export function toggleFlipYSetSquare(id) {
    if (boardData.setSquares) {
        const sq = boardData.setSquares.find(s => s.id === id);
        if (sq) {
            sq.flipY = !sq.flipY;
            boardData.setSquares = [...boardData.setSquares];
        }
    }
}

export function addProtractor() {
    const screenCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    const screenCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
    const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
    const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;

    const newProtractor = {
        id: Date.now() + Math.random(),
        x: canvasX,
        y: canvasY,
        angle: 0,
        radiusCm: 6.0,
        scaleFactor: 1.0,
        flipY: false
    };
    boardData.protractors = [...(boardData.protractors || []), newProtractor];
}

export function deleteProtractor(id) {
    if (boardData.protractors) {
        boardData.protractors = boardData.protractors.filter(p => p.id !== id);
    }
}

export function toggleFlipYProtractor(id) {
    if (boardData.protractors) {
        const protractor = boardData.protractors.find(p => p.id === id);
        if (protractor) {
            protractor.flipY = !protractor.flipY;
            boardData.protractors = [...boardData.protractors];
        }
    }
}

// --- Налаштування фону дошки ---

const BG_STORAGE_KEY = 'kvoka-bg-settings';

function loadBgSettings() {
    try {
        const saved = localStorage.getItem(BG_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                overlay:      typeof parsed.overlay      === 'string' ? parsed.overlay      : 'grid',
                scale:        typeof parsed.scale        === 'number' ? parsed.scale        : 40,
                overlayColor: typeof parsed.overlayColor === 'string' ? parsed.overlayColor : '#d0d8e8',
                bgColor:      typeof parsed.bgColor      === 'string' ? parsed.bgColor      : '#ffffff',
            };
        }
    } catch (e) {
        console.warn('Failed to load bg settings from localStorage', e);
    }
    return { overlay: 'grid', scale: 40, overlayColor: '#d0d8e8', bgColor: '#ffffff' };
}

export const bgSettings = $state(loadBgSettings());

export function saveBgSettings() {
    try {
        localStorage.setItem(BG_STORAGE_KEY, JSON.stringify({
            overlay:      bgSettings.overlay,
            scale:        bgSettings.scale,
            overlayColor: bgSettings.overlayColor,
            bgColor:      bgSettings.bgColor,
        }));
    } catch (e) {
        console.warn('Failed to save bg settings to localStorage', e);
    }
}

// --- Користувацькі панелі інструментів ---
export const customPanelsData = $state({
    panels: [],
    isMainToolbarVisible: true
});