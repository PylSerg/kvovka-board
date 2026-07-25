<script>
    import { boardData } from "$lib";

    let isGenerating = $state(false);

    function addVerticalFrame() {
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
        const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;
        
        const width = 297.5; // A4 portrait width in pt (2x smaller)
        const height = 421;  // A4 portrait height in pt (2x smaller)
        const nextNumber = boardData.pdfFrames.length > 0 
            ? Math.max(...boardData.pdfFrames.map(f => f.number)) + 1 
            : 1;

        boardData.pdfFrames = [
            ...boardData.pdfFrames,
            {
                id: Date.now() + Math.random(),
                x: canvasX - width / 2,
                y: canvasY - height / 2,
                width,
                height,
                isVertical: true,
                number: nextNumber
            }
        ];
    }

    function addHorizontalFrame() {
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        const canvasX = (screenCenterX - boardData.offsetX) / boardData.zoom;
        const canvasY = (screenCenterY - boardData.offsetY) / boardData.zoom;
        
        const width = 421;   // A4 landscape width in pt (2x smaller)
        const height = 297.5; // A4 landscape height in pt (2x smaller)
        const nextNumber = boardData.pdfFrames.length > 0 
            ? Math.max(...boardData.pdfFrames.map(f => f.number)) + 1 
            : 1;

        boardData.pdfFrames = [
            ...boardData.pdfFrames,
            {
                id: Date.now() + Math.random(),
                x: canvasX - width / 2,
                y: canvasY - height / 2,
                width,
                height,
                isVertical: false,
                number: nextNumber
            }
        ];
    }

    function cancel() {
        boardData.isPdfMode = false;
        boardData.pdfFrames = [];
    }

    function renderFrameToDataUrl(frame) {
        const isVertical = frame.isVertical;
        // Target high-res sizing (short side 1500px, long side ~2121px)
        const shortSide = 1500;
        const longSide = Math.round(shortSide * 1.4142);
        const canvasWidth = isVertical ? shortSide : longSide;
        const canvasHeight = isVertical ? longSide : shortSide;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvasWidth;
        tempCanvas.height = canvasHeight;
        const tempCtx = tempCanvas.getContext("2d");

        // 1. Draw solid white page background
        tempCtx.fillStyle = "#ffffff";
        tempCtx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. Draw lines on a transparent offscreen canvas for erasers
        const offCanvas = document.createElement("canvas");
        offCanvas.width = canvasWidth;
        offCanvas.height = canvasHeight;
        const offCtx = offCanvas.getContext("2d");

        const scale = canvasWidth / frame.width;
        offCtx.save();
        offCtx.scale(scale, scale);
        offCtx.translate(-frame.x, -frame.y);

        boardData.lines.forEach((line) => {
            const isEraser = line.tool === "eraser" || line.color === "#ffffff";
            if (isEraser) {
                offCtx.globalCompositeOperation = "destination-out";
            } else {
                offCtx.globalCompositeOperation = "source-over";
            }

            offCtx.strokeStyle = line.color;
            offCtx.shadowBlur = 0;
            offCtx.lineWidth = line.width;
            offCtx.lineCap = "round";
            offCtx.lineJoin = "round";

            if (!line.points || line.points.length === 0) return;

            offCtx.beginPath();
            offCtx.moveTo(line.points[0].x, line.points[0].y);

            if (line.points.length === 1) {
                offCtx.lineTo(line.points[0].x, line.points[0].y);
            } else if (line.points.length === 2) {
                offCtx.lineTo(line.points[1].x, line.points[1].y);
            } else {
                for (let i = 1; i < line.points.length - 2; i++) {
                    const xc = (line.points[i].x + line.points[i + 1].x) / 2;
                    const yc = (line.points[i].y + line.points[i + 1].y) / 2;
                    offCtx.quadraticCurveTo(line.points[i].x, line.points[i].y, xc, yc);
                }
                offCtx.quadraticCurveTo(
                    line.points[line.points.length - 2].x,
                    line.points[line.points.length - 2].y,
                    line.points[line.points.length - 1].x,
                    line.points[line.points.length - 1].y
                );
            }
            offCtx.stroke();
        });

        offCtx.restore();
        tempCtx.drawImage(offCanvas, 0, 0);

        return tempCanvas.toDataURL("image/jpeg", 0.92);
    }

    async function generatePdf() {
        if (boardData.pdfFrames.length === 0) return;
        isGenerating = true;

        try {
            // Sort frames by number
            const sortedFrames = [...boardData.pdfFrames].sort((a, b) => a.number - b.number);
            
            const { jsPDF } = await import("jspdf");
            
            let doc = null;

            for (let i = 0; i < sortedFrames.length; i++) {
                const frame = sortedFrames[i];
                const isVertical = frame.isVertical;
                const imgData = renderFrameToDataUrl(frame);
                const orientation = isVertical ? "portrait" : "landscape";
                
                if (i === 0) {
                    doc = new jsPDF({
                        orientation: orientation,
                        unit: "mm",
                        format: "a4"
                    });
                } else {
                    doc.addPage("a4", orientation);
                }

                const pageWidth = isVertical ? 210 : 297;
                const pageHeight = isVertical ? 297 : 210;
                doc.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
            }

            if (doc) {
                const date = new Date();
                const timestamp = date.toISOString().split('T')[0];
                doc.save(`kvoka-board-${timestamp}.pdf`);
            }
            
            // Clean up and exit mode
            boardData.isPdfMode = false;
            boardData.pdfFrames = [];
        } catch (err) {
            console.error("Failed to generate PDF:", err);
            alert("Помилка при створенні PDF: " + err.message);
        } finally {
            isGenerating = false;
        }
    }
</script>

<div class="pdf-panel">
    <div class="panel-title">Режим PDF фреймів</div>
    <div class="divider"></div>
    
    <button
        onclick={addVerticalFrame}
        class="panel-btn action"
        title="Додати вертикальну сторінку А4 (Portrait)"
    >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="9" x2="12" y2="15"></line>
            <line x1="9" y1="12" x2="15" y2="12"></line>
        </svg>
        <span>+ Вертикальний А4</span>
    </button>
    
    <button
        onclick={addHorizontalFrame}
        class="panel-btn action"
        title="Додати горизонтальну сторінку А4 (Landscape)"
    >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="12" y1="9" x2="12" y2="15"></line>
            <line x1="9" y1="12" x2="15" y2="12"></line>
        </svg>
        <span>+ Горизонтальний А4</span>
    </button>
    
    <div class="divider"></div>
    
    <button
        onclick={generatePdf}
        class="panel-btn primary"
        disabled={boardData.pdfFrames.length === 0 || isGenerating}
        title="Зберегти всі сторінки в PDF"
    >
        {#if isGenerating}
            <span class="spinner"></span>
            <span>Створення...</span>
        {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Експортувати в PDF</span>
        {/if}
    </button>
    
    <button
        onclick={cancel}
        class="panel-btn danger"
        disabled={isGenerating}
        title="Скасувати та повернутися"
    >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span>Скасувати</span>
    </button>
</div>

<style>
    .pdf-panel {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05);
        border-radius: 16px;
        padding: 10px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1002;
        animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translate(-50%, 20px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }

    .panel-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin-right: 4px;
        white-space: nowrap;
    }

    .divider {
        width: 1px;
        height: 24px;
        background: rgba(0, 0, 0, 0.1);
        margin: 0 4px;
    }

    .panel-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border: 1px solid transparent;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .panel-btn.action {
        background: #f1f3f5;
        border-color: rgba(0, 0, 0, 0.05);
        color: #495057;
    }

    .panel-btn.action:hover {
        background: #e9ecef;
        color: #212529;
        transform: translateY(-1px);
    }

    .panel-btn.primary {
        background: #007bff;
        color: #ffffff;
        box-shadow: 0 4px 10px rgba(0, 123, 255, 0.2);
    }

    .panel-btn.primary:hover:not(:disabled) {
        background: #0056b3;
        transform: translateY(-1px);
        box-shadow: 0 6px 14px rgba(0, 123, 255, 0.3);
    }

    .panel-btn.danger {
        background: #fff5f5;
        border-color: #ffe3e3;
        color: #e03131;
    }

    .panel-btn.danger:hover:not(:disabled) {
        background: #ffe3e3;
        transform: translateY(-1px);
    }

    .panel-btn:active {
        transform: scale(0.98) !important;
    }

    .panel-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        box-shadow: none;
    }

    .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s ease-in-out infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
</style>
