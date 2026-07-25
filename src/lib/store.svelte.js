// src/lib/store.svelte.js

export const brushSettings = $state({
    color: '#000000',
    width: 5,
    tool: 'brush', // 'brush', 'eraser', 'select', 'move', 'shape', 'text'
    shapeType: 'rectangle' // default shape
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
    rulers: []            // Лінійки: { id, x, y, angle, lengthCm, scaleFactor }
});

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