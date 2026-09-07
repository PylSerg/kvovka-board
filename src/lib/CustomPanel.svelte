<script>
    import { onMount, tick } from "svelte";
    import { customPanelsData, savePanelsToDB, brushSettings, boardData, undo, redo, clearAll, saveState, addRuler, addSetSquare, addProtractor, addCompass, addCoordLine, addCoordPlane2D, addCoordPlane3D } from "$lib";
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
    import clearIcon from "$lib/assets/broom.png";
    
    import ColorPicker from "./ColorPicker.svelte";
    import StrokeWidthPicker from "./StrokeWidthPicker.svelte";
    import ShapePicker from "./ShapePicker.svelte";
    import ClearConfirm from "./ClearConfirm.svelte";

    let { panel } = $props();

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let isToolMenuOpen = $state(false);
    let toolMenuContainerEl;
    let menuPopupStyle = $state("");
    let contextMenu = $state({ isOpen: false, x: 0, y: 0, toolId: null });

    if (!panel.tools) panel.tools = [];

    const availableTools = [
        { id: 'move', label: 'Переміщення', category: 'Малювання' },
        { id: 'select', label: 'Виділення', category: 'Малювання' },
        { id: 'brush', label: 'Пензель', category: 'Малювання' },
        { id: 'eraser', label: 'Гумка', category: 'Малювання' },
        { id: 'text', label: 'Текст', category: 'Малювання' },
        { id: 'ruler', label: 'Лінійка', category: 'Інструменти' },
        { id: 'setSquare', label: 'Косинець', category: 'Інструменти' },
        { id: 'protractor', label: 'Транспортир', category: 'Інструменти' },
        { id: 'compass', label: 'Циркуль', category: 'Інструменти' },
        { id: 'coordLine', label: 'Координатна пряма', category: 'Інструменти' },
        { id: 'coordPlane2D', label: 'Координатна площина (x; y)', category: 'Інструменти' },
        { id: 'coordPlane3D', label: 'Координатна площина (x; y; z)', category: 'Інструменти' },
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

    onMount(() => {
        const handleOutsideClick = (e) => {
            if (isToolMenuOpen && toolMenuContainerEl && !toolMenuContainerEl.contains(e.target)) {
                isToolMenuOpen = false;
            }
        };
        window.addEventListener("pointerdown", handleOutsideClick);
        return () => {
            window.removeEventListener("pointerdown", handleOutsideClick);
        };
    });

    async function computeMenuPopupStyle() {
        await tick();
        if (!toolMenuContainerEl) return;
        const rect = toolMenuContainerEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let style = "";
        if (panel.isVertical) {
            if (rect.left < vw / 2) {
                style = "top: 0; bottom: auto; left: calc(100% + 10px); right: auto;";
            } else {
                style = "top: 0; bottom: auto; right: calc(100% + 10px); left: auto;";
            }
            if (rect.top + 420 > vh) {
                style += " transform: translateY(-30%);";
            }
        } else {
            if (rect.top < vh / 2) {
                style = "top: calc(100% + 10px); bottom: auto; left: 0; right: auto;";
            } else {
                style = "bottom: calc(100% + 10px); top: auto; left: 0; right: auto;";
            }
            if (rect.left + 350 > vw) {
                style = style.replace("left: 0; right: auto;", "right: 0; left: auto;");
            }
        }
        menuPopupStyle = style;
    }

    function toggleToolMenu() {
        isToolMenuOpen = !isToolMenuOpen;
        if (isToolMenuOpen) {
            computeMenuPopupStyle();
        }
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
                    return {
                        ...line,
                        color: brushSettings.color,
                        width: brushSettings.width,
                        ...(line.tool === "shape" || line.tool === "brush"
                            ? { fillColor: brushSettings.fillColor }
                            : {}),
                    };
                }
                return line;
            });
        }
    }

    function handleInput() { applySettingsToSelected(); }
    function handleStartEdit() { if (boardData.selectedLineIds.length > 0) saveState(); }

    function exportBoard() {
        try {
            const dataStr = JSON.stringify({
                version: 1,
                lines: boardData.lines,
                rulers: boardData.rulers,
                setSquares: boardData.setSquares,
                protractors: boardData.protractors,
                compasses: boardData.compasses,
                coordLines: boardData.coordLines,
                coordPlanes2D: boardData.coordPlanes2D,
                coordPlanes3D: boardData.coordPlanes3D,
                zoom: boardData.zoom,
                offsetX: boardData.offsetX,
                offsetY: boardData.offsetY
            }, null, 2);
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
            {:else if toolId === 'setSquare'}
                <button onclick={addSetSquare} title="Додати косинець" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><polygon points="3,3 21,21 3,21"></polygon><line x1="7" y1="21" x2="7" y2="18"></line><line x1="11" y1="21" x2="11" y2="18"></line><line x1="15" y1="21" x2="15" y2="18"></line><line x1="3" y1="17" x2="6" y2="17"></line><line x1="3" y1="13" x2="6" y2="13"></line><line x1="3" y1="9" x2="6" y2="9"></line></svg>
                </button>
            {:else if toolId === 'protractor'}
                <button onclick={addProtractor} title="Додати транспортир" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><path d="M 3 19 A 9 9 0 0 1 21 19 Z"></path><line x1="12" y1="19" x2="12" y2="16"></line><line x1="6.3" y1="13.3" x2="8.4" y2="14.8"></line><line x1="17.7" y1="13.3" x2="15.6" y2="14.8"></line></svg>
                </button>
            {:else if toolId === 'compass'}
                <button onclick={addCompass} title="Додати циркуль" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><path d="M12 2v4"></path><circle cx="12" cy="7" r="2"></circle><path d="M10.5 8.5 L5 21"></path><path d="M13.5 8.5 L19 21"></path><circle cx="5" cy="21" r="1" fill="currentColor"></circle></svg>
                </button>
            {:else if toolId === 'coordLine'}
                <button onclick={addCoordLine} title="Додати координатну пряму" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><line x1="2" y1="12" x2="22" y2="12"></line><polyline points="17 7 22 12 17 17"></polyline><line x1="6" y1="9" x2="6" y2="15"></line><line x1="12" y1="8" x2="12" y2="16"></line><line x1="18" y1="9" x2="18" y2="15"></line></svg>
                </button>
            {:else if toolId === 'coordPlane2D'}
                <button onclick={addCoordPlane2D} title="Додати координатну площину (x; y)" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><line x1="3" y1="12" x2="21" y2="12"></line><polyline points="17 8 21 12 17 16"></polyline><line x1="12" y1="21" x2="12" y2="3"></line><polyline points="8 7 12 3 16 7"></polyline><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle></svg>
                </button>
            {:else if toolId === 'coordPlane3D'}
                <button onclick={addCoordPlane3D} title="Додати координатну площину (x; y; z)" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><line x1="12" y1="12" x2="21" y2="12"></line><polyline points="18 9 21 12 18 15"></polyline><line x1="12" y1="12" x2="12" y2="3"></line><polyline points="9 6 12 3 15 6"></polyline><line x1="12" y1="12" x2="4" y2="20"></line><polyline points="4 16 4 20 8 20"></polyline><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle></svg>
                </button>
            {:else if toolId === 'colorPicker'}
                <ColorPicker bind:color={brushSettings.color} onChange={handleInput} onStartEdit={handleStartEdit} disabled={brushSettings.tool === "eraser"} isVertical={panel.isVertical} />
            {:else if toolId === 'strokeWidth'}
                <StrokeWidthPicker bind:width={brushSettings.width} onChange={handleInput} onStartEdit={handleStartEdit} isVertical={panel.isVertical} />
            {:else if toolId === 'shapePicker'}
                <ShapePicker isVertical={panel.isVertical} disabled={brushSettings.tool === "eraser"} onToolSelect={(tool) => (brushSettings.tool = tool)} onChange={handleInput} onStartEdit={handleStartEdit} />
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

    <div style="position: relative;" bind:this={toolMenuContainerEl}>
        <button onclick={toggleToolMenu} title="Додати інструмент" class="action-btn add-tool-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        
        {#if isToolMenuOpen}
            <div class="tool-menu" style={menuPopupStyle} onpointerdown={(e) => e.stopPropagation()}>
                <div class="tool-menu-header">
                    <span>Додати інструмент</span>
                </div>
                <div class="tool-menu-grid">
                    {#each availableTools as t}
                        <button 
                            type="button"
                            class="tool-grid-item" 
                            class:disabled={panel.tools.includes(t.id)} 
                            onclick={() => addTool(t.id)}
                            title={panel.tools.includes(t.id) ? `${t.label} (вже додано)` : t.label}
                        >
                            <div class="item-icon-container">
                                {#if t.id === 'move'}
                                    <img src={moveIcon} alt={t.label} class="icon" />
                                {:else if t.id === 'select'}
                                    <img src={selectionIcon} alt={t.label} class="icon" />
                                {:else if t.id === 'brush'}
                                    <img src={pencilIcon} alt={t.label} class="icon" />
                                {:else if t.id === 'eraser'}
                                    <img src={eraserIcon} alt={t.label} class="icon" />
                                {:else if t.id === 'text'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
                                {:else if t.id === 'ruler'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><rect x="2" y="6" width="20" height="12" rx="2"></rect><line x1="6" y1="6" x2="6" y2="12"></line><line x1="10" y1="6" x2="10" y2="10"></line><line x1="14" y1="6" x2="14" y2="12"></line><line x1="18" y1="6" x2="18" y2="10"></line></svg>
                                {:else if t.id === 'setSquare'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><polygon points="3,3 21,21 3,21"></polygon><line x1="7" y1="21" x2="7" y2="18"></line><line x1="11" y1="21" x2="11" y2="18"></line><line x1="15" y1="21" x2="15" y2="18"></line><line x1="3" y1="17" x2="6" y2="17"></line><line x1="3" y1="13" x2="6" y2="13"></line><line x1="3" y1="9" x2="6" y2="9"></line></svg>
                                {:else if t.id === 'protractor'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><path d="M 3 19 A 9 9 0 0 1 21 19 Z"></path><line x1="12" y1="19" x2="12" y2="16"></line><line x1="6.3" y1="13.3" x2="8.4" y2="14.8"></line><line x1="17.7" y1="13.3" x2="15.6" y2="14.8"></line></svg>
                                {:else if t.id === 'compass'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><path d="M12 2v4"></path><circle cx="12" cy="7" r="2"></circle><path d="M10.5 8.5 L5 21"></path><path d="M13.5 8.5 L19 21"></path><circle cx="5" cy="21" r="1" fill="currentColor"></circle></svg>
                                {:else if t.id === 'coordLine'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><line x1="2" y1="12" x2="22" y2="12"></line><polyline points="17 7 22 12 17 17"></polyline><line x1="6" y1="9" x2="6" y2="15"></line><line x1="12" y1="8" x2="12" y2="16"></line><line x1="18" y1="9" x2="18" y2="15"></line></svg>
                                {:else if t.id === 'coordPlane2D'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><line x1="3" y1="12" x2="21" y2="12"></line><polyline points="17 8 21 12 17 16"></polyline><line x1="12" y1="21" x2="12" y2="3"></line><polyline points="8 7 12 3 16 7"></polyline><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle></svg>
                                {:else if t.id === 'coordPlane3D'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><line x1="12" y1="12" x2="21" y2="12"></line><polyline points="18 9 21 12 18 15"></polyline><line x1="12" y1="12" x2="12" y2="3"></line><polyline points="9 6 12 3 15 6"></polyline><line x1="12" y1="12" x2="4" y2="20"></line><polyline points="4 16 4 20 8 20"></polyline><circle cx="12" cy="12" r="1.5" fill="currentColor"></circle></svg>
                                {:else if t.id === 'colorPicker'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>
                                {:else if t.id === 'strokeWidth'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><line x1="3" y1="6" x2="21" y2="6" stroke-width="1.5"></line><line x1="3" y1="12" x2="21" y2="12" stroke-width="3"></line><line x1="3" y1="18" x2="21" y2="18" stroke-width="4.5"></line></svg>
                                {:else if t.id === 'shapePicker'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><polygon points="12 4 4 19 20 19"></polygon><circle cx="17" cy="8" r="3"></circle></svg>
                                {:else if t.id === 'zoomIn'}
                                    <img src={zoomInIcon} alt={t.label} class="icon" />
                                {:else if t.id === 'zoomOut'}
                                    <img src={zoomOutIcon} alt={t.label} class="icon" />
                                {:else if t.id === 'zoom100'}
                                    <img src={zoom100Icon} alt={t.label} class="icon" />
                                {:else if t.id === 'undo'}
                                    <img src={undoIcon} alt={t.label} class="icon" />
                                {:else if t.id === 'redo'}
                                    <img src={redoIcon} alt={t.label} class="icon" />
                                {:else if t.id === 'clearConfirm'}
                                    <img src={clearIcon} alt={t.label} class="icon" />
                                {:else if t.id === 'exportBoard'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                {:else if t.id === 'exportPdf'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon text-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><circle cx="10" cy="9" r="1"></circle></svg>
                                {/if}
                            </div>
                            <span class="item-label">{t.label}</span>
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
        top: 0;
        left: calc(100% + 10px);
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
        border: 1px solid #e2e8f0;
        z-index: 1001;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        cursor: default;
        user-select: none;
    }
    
    .tool-menu-header {
        padding: 8px 12px;
        font-weight: 600;
        border-bottom: 1px solid #e9ecef;
        background: #f8f9fa;
        font-size: 13px;
        color: #495057;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .tool-menu-grid {
        display: grid;
        grid-auto-flow: column;
        grid-template-rows: repeat(6, 62px);
        gap: 6px;
        padding: 8px;
        overflow-x: auto;
    }
    
    .tool-grid-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 62px;
        padding: 4px 6px;
        border-radius: 8px;
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        cursor: pointer;
        transition: all 0.15s ease;
        gap: 3px;
        box-sizing: border-box;
        
        &:hover:not(.disabled) {
            background: #e7f1ff;
            border-color: #bad3fe;
            color: #0d6efd;
            transform: translateY(-1px);

            .item-icon-container .text-icon {
                color: #0d6efd;
            }
        }
        
        &:active:not(.disabled) {
            transform: translateY(0);
        }

        &.disabled {
            opacity: 0.4;
            cursor: not-allowed;
            background: #f1f3f5;
            border-color: #e9ecef;
        }

        .item-icon-container {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            
            .icon {
                width: 22px;
                height: 22px;
                object-fit: contain;
            }
            
            .text-icon {
                color: #495057;
                transition: color 0.15s ease;
            }
        }

        .item-label {
            font-size: 11px;
            font-weight: 500;
            line-height: 1.15;
            color: #495057;
            text-align: center;
            max-width: 100%;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
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
