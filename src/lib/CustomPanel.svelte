<script>
    import { customPanelsData, savePanelsToDB, brushSettings, boardData, undo, redo, clearAll, saveState, addRuler } from "$lib";
    import orientationVerticalIcon from "$lib/assets/orientation-vertical.png";
    import orientationHorizontalIcon from "$lib/assets/orientation-horizontal.png";
    import moveIcon from "$lib/assets/hand-cursor.png";
    import pencilIcon from "$lib/assets/pencil.png";
    import eraserIcon from "$lib/assets/eraser.png";
    import selectionIcon from "$lib/assets/selection.png";
    import zoomInIcon from "$lib/assets/zoom-in.png";
    import zoomOutIcon from "$lib/assets/zoom-out.png";
    import zoom100Icon from "$lib/assets/zoom-100.png";
    import undoIcon from "$lib/assets/undo.png";
    import redoIcon from "$lib/assets/redo.png";
    
    import ColorPicker from "./ColorPicker.svelte";
    import StrokeWidthPicker from "./StrokeWidthPicker.svelte";
    import ShapePicker from "./ShapePicker.svelte";
    import ClearConfirm from "./ClearConfirm.svelte";

    let { panel } = $props();

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let isToolMenuOpen = $state(false);
    let contextMenu = $state({ isOpen: false, x: 0, y: 0, toolId: null });

    if (!panel.tools) panel.tools = [];

    const availableTools = [
        { id: 'move', label: 'Переміщення', category: 'Малювання' },
        { id: 'select', label: 'Виділення', category: 'Малювання' },
        { id: 'brush', label: 'Пензель', category: 'Малювання' },
        { id: 'eraser', label: 'Гумка', category: 'Малювання' },
        { id: 'text', label: 'Текст', category: 'Малювання' },
        { id: 'ruler', label: 'Лінійка', category: 'Інструменти' },
        { id: 'colorPicker', label: 'Колір', category: 'Налаштування' },
        { id: 'strokeWidth', label: 'Товщина', category: 'Налаштування' },
        { id: 'shapePicker', label: 'Форми', category: 'Малювання' },
        { id: 'zoomIn', label: 'Збільшити', category: 'Масштаб' },
        { id: 'zoomOut', label: 'Зменшити', category: 'Масштаб' },
        { id: 'zoom100', label: 'Масштаб 100%', category: 'Масштаб' },
        { id: 'undo', label: 'Назад', category: 'Дії' },
        { id: 'redo', label: 'Вперед', category: 'Дії' },
        { id: 'clearConfirm', label: 'Очистити', category: 'Дії' },
        { id: 'exportBoard', label: 'Зберегти дошку', category: 'Меню' },
        { id: 'exportPdf', label: 'Експорт у PDF', category: 'Меню' }
    ];

    function saveSettings() {
        savePanelsToDB({
            panels: $state.snapshot(customPanelsData.panels),
            isMainToolbarVisible: customPanelsData.isMainToolbarVisible
        }).catch(console.error);
    }

    function startDrag(e) {
        if (
            e.target.tagName === "BUTTON" ||
            e.target.tagName === "INPUT" ||
            e.target.closest("button") ||
            e.target.closest(".tool-menu")
        ) {
            return;
        }
        isDragging = true;
        e.preventDefault();
        startX = e.clientX - panel.posX;
        startY = e.clientY - panel.posY;
        window.addEventListener("pointermove", handleDrag);
        window.addEventListener("pointerup", stopDrag);
        window.addEventListener("pointercancel", stopDrag);
    }

    function handleDrag(e) {
        if (!isDragging) return;
        panel.posX = e.clientX - startX;
        panel.posY = e.clientY - startY;
    }

    function stopDrag() {
        isDragging = false;
        window.removeEventListener("pointermove", handleDrag);
        window.removeEventListener("pointerup", stopDrag);
        window.removeEventListener("pointercancel", stopDrag);
        saveSettings();
    }

    function toggleOrientation() {
        panel.isVertical = !panel.isVertical;
        saveSettings();
    }

    function closePanel() {
        panel.isVisible = false;
        saveSettings();
    }

    function toggleToolMenu() {
        isToolMenuOpen = !isToolMenuOpen;
    }

    function addTool(toolId) {
        if (!panel.tools.includes(toolId)) {
            panel.tools = [...panel.tools, toolId];
            saveSettings();
        }
        isToolMenuOpen = false;
    }

    function handleContextMenu(e, toolId) {
        e.preventDefault();
        e.stopPropagation();
        contextMenu = {
            isOpen: true,
            x: e.clientX,
            y: e.clientY,
            toolId
        };
    }

    function closeContextMenu() {
        if (contextMenu.isOpen) {
            contextMenu.isOpen = false;
        }
    }

    function confirmRemoveTool() {
        if (contextMenu.toolId) {
            panel.tools = panel.tools.filter(id => id !== contextMenu.toolId);
            saveSettings();
        }
        closeContextMenu();
    }

    import { flip } from 'svelte/animate';
    import { quintOut } from 'svelte/easing';

    let draggedToolId = $state(null);

    function handleDragStartTool(e, toolId) {
        draggedToolId = toolId;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', toolId);
        }
    }

    function handleDragEnterTool(e, targetToolId) {
        if (draggedToolId && draggedToolId !== targetToolId) {
            const fromIndex = panel.tools.indexOf(draggedToolId);
            const toIndex = panel.tools.indexOf(targetToolId);
            
            const newTools = [...panel.tools];
            newTools.splice(fromIndex, 1);
            newTools.splice(toIndex, 0, draggedToolId);
            panel.tools = newTools;
        }
    }

    function handleDragOverTool(e) {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    }

    function handleDropTool(e) {
        e.preventDefault();
        saveSettings();
        draggedToolId = null;
    }

    function handleDragEndTool() {
        saveSettings();
        draggedToolId = null;
    }

    // Handlers for specific tools
    function zoomIn() { boardData.zoom = Math.min(10, boardData.zoom + 0.1); }
    function zoomOut() { boardData.zoom = Math.max(0.1, boardData.zoom - 0.1); }
    function resetZoom() { boardData.zoom = 1; boardData.offsetX = 0; boardData.offsetY = 0; }
    
    function applySettingsToSelected() {
        if (boardData.selectedLineIds.length > 0) {
            boardData.lines = boardData.lines.map((line) => {
                if (boardData.selectedLineIds.includes(line.id)) {
                    return { ...line, color: brushSettings.color, width: brushSettings.width };
                }
                return line;
            });
        }
    }

    function handleInput() { applySettingsToSelected(); }
    function handleStartEdit() { if (boardData.selectedLineIds.length > 0) saveState(); }

    function exportBoard() {
        try {
            const dataStr = JSON.stringify({ version: 1, lines: boardData.lines, zoom: boardData.zoom, offsetX: boardData.offsetX, offsetY: boardData.offsetY }, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `kvoka-board-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
        }
    }

    function enterPdfMode() {
        boardData.isPdfMode = true;
        boardData.selectedLineIds = [];
        if (boardData.pdfFrames.length === 0) {
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
            const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;
            const defWidth = 297.5;
            const defHeight = 421;
            boardData.pdfFrames = [{ id: Date.now() + Math.random(), x: canvasX - defWidth / 2, y: canvasY - defHeight / 2, width: defWidth, height: defHeight, isVertical: true, number: 1 }];
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="toolbar" class:horizontal={!panel.isVertical} onpointerdown={startDrag} style="left: {panel.posX}px; top: {panel.posY}px;">
    <div class="drag-handle" title="Перетягнути панель">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="15" cy="19" r="2"/>
        </svg>
    </div>

    <button onclick={toggleOrientation} title="Змінити орієнтацію панелі" class="orientation-btn">
        <img src={panel.isVertical ? orientationHorizontalIcon : orientationVerticalIcon} alt="Орієнтація" class="icon" />
    </button>
    
    <hr />

    <!-- Dynamic Tools Rendering -->
    {#each panel.tools as toolId (toolId)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
            class="tool-wrapper" 
            class:is-dragging={draggedToolId === toolId}
            draggable="true"
            animate:flip={{duration: 250, easing: quintOut}}
            ondragstart={(e) => handleDragStartTool(e, toolId)}
            ondragenter={(e) => handleDragEnterTool(e, toolId)}
            ondragover={handleDragOverTool}
            ondrop={handleDropTool}
            ondragend={handleDragEndTool}
            oncontextmenu={(e) => handleContextMenu(e, toolId)}
        >
            {#if toolId === 'move'}
                <button class={brushSettings.tool === "move" ? "active" : ""} onclick={() => (brushSettings.tool = "move")} title="Переміщення"><img src={moveIcon} alt="Move" class="icon" /></button>
            {:else if toolId === 'select'}
                <button class={brushSettings.tool === "select" ? "active" : ""} onclick={() => (brushSettings.tool = "select")} title="Виділення"><img src={selectionIcon} alt="Select" class="icon" /></button>
            {:else if toolId === 'brush'}
                <button class={brushSettings.tool === "brush" ? "active" : ""} onclick={() => (brushSettings.tool = "brush")} title="Пензель"><img src={pencilIcon} alt="Brush" class="icon" /></button>
            {:else if toolId === 'eraser'}
                <button class={brushSettings.tool === "eraser" ? "active" : ""} onclick={() => (brushSettings.tool = "eraser")} title="Гумка"><img src={eraserIcon} alt="Eraser" class="icon" /></button>
            {:else if toolId === 'text'}
                <button class={brushSettings.tool === "text" ? "active" : ""} onclick={() => (brushSettings.tool = "text")} title="Текст">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
                </button>
            {:else if toolId === 'ruler'}
                <button onclick={addRuler} title="Додати лінійку" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><rect x="2" y="6" width="20" height="12" rx="2"></rect><line x1="6" y1="6" x2="6" y2="12"></line><line x1="10" y1="6" x2="10" y2="10"></line><line x1="14" y1="6" x2="14" y2="12"></line><line x1="18" y1="6" x2="18" y2="10"></line></svg>
                </button>
            {:else if toolId === 'colorPicker'}
                <ColorPicker bind:color={brushSettings.color} onChange={handleInput} onStartEdit={handleStartEdit} disabled={brushSettings.tool === "eraser"} isVertical={panel.isVertical} />
            {:else if toolId === 'strokeWidth'}
                <StrokeWidthPicker bind:width={brushSettings.width} onChange={handleInput} onStartEdit={handleStartEdit} isVertical={panel.isVertical} />
            {:else if toolId === 'shapePicker'}
                <ShapePicker isVertical={panel.isVertical} disabled={brushSettings.tool === "eraser"} onToolSelect={(tool) => (brushSettings.tool = tool)} />
            {:else if toolId === 'zoomIn'}
                <button onclick={zoomIn} title="Збільшити" class="action-btn"><img src={zoomInIcon} alt="Zoom In" class="icon" /></button>
            {:else if toolId === 'zoomOut'}
                <button onclick={zoomOut} title="Зменшити" class="action-btn"><img src={zoomOutIcon} alt="Zoom Out" class="icon" /></button>
            {:else if toolId === 'zoom100'}
                <button onclick={resetZoom} title="100%" class="action-btn"><img src={zoom100Icon} alt="100%" class="icon" /></button>
            {:else if toolId === 'undo'}
                <button onclick={undo} title="Назад" class="action-btn"><img src={undoIcon} alt="Undo" class="icon" /></button>
            {:else if toolId === 'redo'}
                <button onclick={redo} title="Вперед" class="action-btn"><img src={redoIcon} alt="Redo" class="icon" /></button>
            {:else if toolId === 'clearConfirm'}
                <ClearConfirm isVertical={panel.isVertical} onConfirm={clearAll} />
            {:else if toolId === 'exportBoard'}
                <button onclick={exportBoard} title="Зберегти дошку" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
            {:else if toolId === 'exportPdf'}
                <button onclick={enterPdfMode} title="Експорт у PDF" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><circle cx="10" cy="9" r="1"></circle></svg>
                </button>
            {/if}
        </div>
    {/each}

    {#if panel.tools.length > 0}
        <hr />
    {/if}

    <div style="position: relative;">
        <button onclick={toggleToolMenu} title="Додати інструмент" class="action-btn add-tool-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        
        {#if isToolMenuOpen}
            <div class="tool-menu" onpointerdown={(e) => e.stopPropagation()}>
                <div class="tool-menu-header">Додати інструмент</div>
                <div class="tool-menu-list">
                    {#each availableTools as t}
                        <button class="tool-menu-item" class:disabled={panel.tools.includes(t.id)} onclick={() => addTool(t.id)}>
                            {t.label} <span class="tool-cat">({t.category})</span>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <hr />

    <button onclick={closePanel} title="Закрити панель (Сховати)" class="action-btn delete-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
</div>

{#if contextMenu.isOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
        class="context-menu-overlay" 
        onpointerdown={closeContextMenu}
        oncontextmenu={(e) => { e.preventDefault(); closeContextMenu(); }}
    ></div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
        class="context-menu" 
        style="left: {contextMenu.x}px; top: {contextMenu.y}px;" 
        onpointerdown={(e) => e.stopPropagation()}
        oncontextmenu={(e) => e.preventDefault()}
    >
        <button class="context-menu-item" onclick={confirmRemoveTool}>
            Видалити
        </button>
    </div>
{/if}

<style lang="scss">
    .toolbar {
        position: fixed;
        width: auto;
        min-width: 36px;
        background: #ffffff;
        padding: 6px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        z-index: 1000;
        cursor: grab;
        user-select: none;
        touch-action: none;

        &:active {
            cursor: grabbing;
        }

        .drag-handle {
            display: flex;
            justify-content: center;
            align-items: center;
            color: #ccc;
            padding: 2px;
            transition: color 0.2s;

            &:hover {
                color: #888;
            }
        }

        &.horizontal {
            flex-direction: row;
            height: auto;
            min-height: 36px;

            .drag-handle {
                transform: rotate(90deg);
            }

            hr {
                width: 1px;
                height: 24px;
                border-top: none;
                border-left: 1px solid #ddd;
                margin: 0 4px;
            }
            
            .tool-menu {
                left: 100%;
                top: 0;
                margin-left: 10px;
                margin-top: 0;
            }
        }
    }

    button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background-color: transparent;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: background-color 0.2s;

        &:hover {
            background-color: #c7dff9;
        }

        .icon {
            width: 20px;
            height: 20px;
            object-fit: contain;
        }
        
        .text-icon {
            color: #333;
        }
    }
    
    button.active {
        background-color: #007bff;
        .icon {
            filter: invert(1);
        }
        .text-icon {
            color: #fff;
            filter: none;
        }
        &:hover {
            background-color: #0056b3;
        }
    }

    .action-btn {
        color: #333;
        font-weight: bold;

        &:active {
            transform: scale(0.95);
        }
    }
    
    .add-tool-btn {
        color: #28a745;
        &:hover {
            background-color: #d4edda;
        }
    }

    .delete-btn {
        color: #6c757d;
        &:hover {
            background-color: #e2e3e5;
        }
    }

    hr {
        width: 100%;
        border: none;
        border-top: 1px solid #ddd;
        margin: 2px 0;
    }
    
    .tool-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        
        &.is-dragging {
            opacity: 0.4;
        }
    }
    
    .tool-menu {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 10px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        width: 220px;
        z-index: 1001;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    
    .tool-menu-header {
        padding: 10px 15px;
        font-weight: bold;
        border-bottom: 1px solid #ddd;
        background: #f8f9fa;
        font-size: 14px;
        color: #333;
    }
    
    .tool-menu-list {
        max-height: 250px;
        overflow-y: auto;
        padding: 5px;
    }
    
    .tool-menu-item {
        width: 100%;
        height: auto;
        padding: 8px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-align: left;
        border-radius: 6px;
        font-size: 14px;
        color: #333;
        
        .tool-cat {
            font-size: 11px;
            color: #888;
        }
        
        &.disabled {
            opacity: 0.5;
            cursor: not-allowed;
            &:hover {
                background: transparent;
            }
        }
    }

    .context-menu-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2000;
    }

    .context-menu {
        position: fixed;
        background: #ffffff;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 4px;
        z-index: 2001;
        min-width: 120px;
    }

    .context-menu-item {
        width: 100%;
        height: 32px;
        justify-content: flex-start;
        padding: 0 12px;
        font-size: 14px;
        color: #dc3545;
        border-radius: 4px;

        &:hover {
            background-color: #f8d7da;
        }
    }
</style>
