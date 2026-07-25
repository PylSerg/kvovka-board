<script>
    import { onMount } from "svelte";
    import { boardData } from "$lib";

    let selectedFrameId = $state(null);
    let contextMenu = $state({ show: false, x: 0, y: 0, frameId: null });

    // Drag states
    let isDragging = false;
    let dragFrame = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let frameStartX = 0;
    let frameStartY = 0;
    let dragPointerId = null;
    let dragTargetEl = null;

    // Resize states
    let isResizing = false;
    let resizeFrame = null;
    let resizeStartX = 0;
    let resizeStartWidth = 0;
    let resizePointerId = null;
    let resizeTargetEl = null;

    onMount(() => {
        const handleOutsideClick = (e) => {
            if (contextMenu.show) {
                contextMenu.show = false;
            }
            // Clear selection if clicking outside any frame or panel
            if (!e.target.closest(".pdf-frame-element") && !e.target.closest(".pdf-panel")) {
                selectedFrameId = null;
            }
        };
        window.addEventListener("pointerdown", handleOutsideClick);
        return () => {
            window.removeEventListener("pointerdown", handleOutsideClick);
        };
    });

    function selectFrame(e, frameId) {
        selectedFrameId = frameId;
    }

    // Dragging
    function startDragFrame(e, frame) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
        if (e.target.closest(".frame-number-input") || e.target.closest(".resize-handle")) {
            return;
        }
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try {
                target.setPointerCapture(pointerId);
            } catch (err) {}
        }

        selectedFrameId = frame.id;
        isDragging = true;
        dragFrame = frame;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        frameStartX = frame.x;
        frameStartY = frame.y;
        dragPointerId = pointerId;
        dragTargetEl = target;
        
        window.addEventListener("pointermove", handleDragFrame);
        window.addEventListener("pointerup", stopDragFrame);
        window.addEventListener("pointercancel", stopDragFrame);
    }

    function handleDragFrame(e) {
        if (!isDragging || !dragFrame) return;
        if (dragPointerId !== null && e.pointerId !== dragPointerId) return;
        const dx = (e.clientX - dragStartX) / boardData.zoom;
        const dy = (e.clientY - dragStartY) / boardData.zoom;
        
        boardData.pdfFrames = boardData.pdfFrames.map(f => {
            if (f.id === dragFrame.id) {
                return {
                    ...f,
                    x: frameStartX + dx,
                    y: frameStartY + dy
                };
            }
            return f;
        });
    }

    function stopDragFrame(e) {
        if (dragTargetEl && dragPointerId !== null && dragTargetEl.releasePointerCapture) {
            try {
                dragTargetEl.releasePointerCapture(dragPointerId);
            } catch (err) {}
        }
        isDragging = false;
        dragFrame = null;
        dragPointerId = null;
        dragTargetEl = null;
        window.removeEventListener("pointermove", handleDragFrame);
        window.removeEventListener("pointerup", stopDragFrame);
        window.removeEventListener("pointercancel", stopDragFrame);
    }

    // Proportional Resizing
    function startResizeFrame(e, frame) {
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();

        const target = e.currentTarget;
        const pointerId = e.pointerId;
        if (target && target.setPointerCapture) {
            try {
                target.setPointerCapture(pointerId);
            } catch (err) {}
        }

        selectedFrameId = frame.id;
        isResizing = true;
        resizeFrame = frame;
        resizeStartX = e.clientX;
        resizeStartWidth = frame.width;
        resizePointerId = pointerId;
        resizeTargetEl = target;
        
        window.addEventListener("pointermove", handleResizeFrame);
        window.addEventListener("pointerup", stopResizeFrame);
        window.addEventListener("pointercancel", stopResizeFrame);
    }

    function handleResizeFrame(e) {
        if (!isResizing || !resizeFrame) return;
        if (resizePointerId !== null && e.pointerId !== resizePointerId) return;
        const dx = (e.clientX - resizeStartX) / boardData.zoom;
        
        let newWidth = resizeStartWidth + dx;
        const minWidth = 50;
        if (newWidth < minWidth) newWidth = minWidth;
        
        // Keep standard A4 ratio: Width / Height
        // Portrait: 595 / 842, Landscape: 842 / 595
        const aspect = resizeFrame.isVertical ? (595 / 842) : (842 / 595);
        const newHeight = newWidth / aspect;

        boardData.pdfFrames = boardData.pdfFrames.map(f => {
            if (f.id === resizeFrame.id) {
                return {
                    ...f,
                    width: newWidth,
                    height: newHeight
                };
            }
            return f;
        });
    }

    function stopResizeFrame(e) {
        if (resizeTargetEl && resizePointerId !== null && resizeTargetEl.releasePointerCapture) {
            try {
                resizeTargetEl.releasePointerCapture(resizePointerId);
            } catch (err) {}
        }
        isResizing = false;
        resizeFrame = null;
        resizePointerId = null;
        resizeTargetEl = null;
        window.removeEventListener("pointermove", handleResizeFrame);
        window.removeEventListener("pointerup", stopResizeFrame);
        window.removeEventListener("pointercancel", stopResizeFrame);
    }

    // Context Menu
    function handleContextMenu(e, frame) {
        e.preventDefault();
        e.stopPropagation();
        selectedFrameId = frame.id;
        contextMenu = {
            show: true,
            x: e.clientX,
            y: e.clientY,
            frameId: frame.id
        };
    }

    function duplicateFrame() {
        const frame = boardData.pdfFrames.find(f => f.id === contextMenu.frameId);
        if (!frame) return;
        
        const nextNumber = boardData.pdfFrames.length > 0 
            ? Math.max(...boardData.pdfFrames.map(f => f.number)) + 1 
            : 1;

        boardData.pdfFrames = [
            ...boardData.pdfFrames,
            {
                ...frame,
                id: Date.now() + Math.random(),
                x: frame.x + 30,
                y: frame.y + 30,
                number: nextNumber
            }
        ];
        contextMenu.show = false;
    }

    function deleteFrame() {
        boardData.pdfFrames = boardData.pdfFrames.filter(f => f.id !== contextMenu.frameId);
        contextMenu.show = false;
    }
</script>

{#if boardData.isPdfMode}
    <div class="pdf-frames-container">
        {#each boardData.pdfFrames as frame (frame.id)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="pdf-frame-element"
                class:selected={selectedFrameId === frame.id}
                style="
                    left: {frame.x * boardData.zoom + boardData.offsetX}px; 
                    top: {frame.y * boardData.zoom + boardData.offsetY}px; 
                    width: {frame.width * boardData.zoom}px; 
                    height: {frame.height * boardData.zoom}px;
                "
                onpointerdown={(e) => startDragFrame(e, frame)}
                oncontextmenu={(e) => handleContextMenu(e, frame)}
            >
                <!-- Page Label / Number Input -->
                <div class="frame-controls">
                    <input
                        type="number"
                        min="1"
                        bind:value={frame.number}
                        class="frame-number-input"
                        title="Номер сторінки в PDF"
                        onpointerdown={(e) => e.stopPropagation()}
                        ontouchstart={(e) => e.stopPropagation()}
                    />
                </div>
                
                <!-- Helper tag for size/aspect -->
                <div class="frame-info">
                    A4 {frame.isVertical ? 'Портрет' : 'Альбом'}
                </div>

                <!-- Proportional Resize Handle -->
                <div
                    class="resize-handle"
                    onpointerdown={(e) => startResizeFrame(e, frame)}
                    title="Змінити розмір пропорційно"
                >
                    <svg viewBox="0 0 100 100" class="resize-icon">
                        <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" stroke-width="12" />
                        <line x1="30" y1="100" x2="100" y2="30" stroke="currentColor" stroke-width="12" />
                        <line x1="60" y1="100" x2="100" y2="60" stroke="currentColor" stroke-width="12" />
                    </svg>
                </div>
            </div>
        {/each}
    </div>

    <!-- Custom Right-Click Context Menu -->
    {#if contextMenu.show}
        <div
            id="pdf-frame-context-menu"
            class="context-menu"
            style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
            onpointerdown={(e) => e.stopPropagation()}
        >
            <button onclick={duplicateFrame} class="menu-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Дублювати</span>
            </button>
            <button onclick={deleteFrame} class="menu-item delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Видалити</span>
            </button>
        </div>
    {/if}
{/if}

<style>
    .pdf-frames-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 1000;
        overflow: hidden;
        touch-action: none;
    }

    .pdf-frame-element {
        position: absolute;
        pointer-events: auto;
        border: 2px dashed rgba(0, 123, 255, 0.4);
        background: rgba(0, 123, 255, 0.03);
        box-sizing: border-box;
        cursor: grab;
        transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .pdf-frame-element:hover {
        border-color: rgba(0, 123, 255, 0.7);
        background: rgba(0, 123, 255, 0.05);
    }

    .pdf-frame-element.selected {
        border: 2px solid #007bff;
        background: rgba(0, 123, 255, 0.06);
        box-shadow: 0 0 15px rgba(0, 123, 255, 0.2), inset 0 0 15px rgba(0, 123, 255, 0.05);
    }

    .pdf-frame-element:active {
        cursor: grabbing;
    }

    .frame-controls {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 10;
        display: flex;
        gap: 6px;
    }

    .frame-number-input {
        width: 36px;
        height: 24px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        text-align: center;
        font-weight: 700;
        font-size: 13px;
        outline: none;
        box-shadow: 0 2px 6px rgba(0, 123, 255, 0.3);
        transition: transform 0.2s, background-color 0.2s;
        touch-action: auto;
    }

    .frame-number-input:hover {
        background-color: #0056b3;
        transform: scale(1.05);
    }

    .frame-number-input:focus {
        background-color: #004085;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.5);
    }

    /* Hide standard HTML number input arrows */
    .frame-number-input::-webkit-outer-spin-button,
    .frame-number-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .frame-info {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        color: white;
        font-size: 10px;
        font-weight: 500;
        padding: 3px 8px;
        border-radius: 4px;
        user-select: none;
        pointer-events: none;
    }

    .resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 26px;
        height: 26px;
        background: #007bff;
        color: white;
        border-top-left-radius: 8px;
        cursor: se-resize;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: -2px -2px 6px rgba(0, 123, 255, 0.15);
        z-index: 10;
        transition: background-color 0.2s, transform 0.1s;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
    }

    .resize-handle::after {
        content: '';
        position: absolute;
        bottom: -6px;
        right: -6px;
        width: 44px;
        height: 44px;
        pointer-events: auto;
    }

    .resize-handle:hover, .resize-handle:active {
        background-color: #0056b3;
        transform: scale(1.15);
    }

    .resize-icon {
        width: 14px;
        height: 14px;
    }

    /* Context Menu */
    .context-menu {
        position: fixed;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.05);
        padding: 5px;
        min-width: 130px;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        gap: 2px;
        animation: scaleIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: top left;
    }

    @keyframes scaleIn {
        from {
            opacity: 0;
            transform: scale(0.92);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    .menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        background: transparent;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        color: #333;
        text-align: left;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }

    .menu-item:hover {
        background: #f1f3f5;
        color: #000;
    }

    .menu-item.delete {
        color: #e03131;
    }

    .menu-item.delete:hover {
        background: #fff5f5;
        color: #c92a2a;
    }
</style>
