<script>
    import { onMount } from "svelte";
    import { boardData, bgSettings, saveBgSettings, saveState, deleteBoardFromDB, customPanelsData, savePanelsToDB, addRuler, addSetSquare } from "$lib";

    let isOpen = $state(false);
    let isBgOpen = $state(false);
    let isPanelsOpen = $state(false);
    let menuContainer;
    let fileInput;

    function toggleMenu() {
        isOpen = !isOpen;
        if (!isOpen) {
            isBgOpen = false;
            isPanelsOpen = false;
        }
    }

    function closeMenu() {
        isOpen = false;
        isBgOpen = false;
        isPanelsOpen = false;
    }

    onMount(() => {
        const handleOutsideClick = (e) => {
            if (isOpen && menuContainer && !menuContainer.contains(e.target)) {
                closeMenu();
            }
        };
        window.addEventListener("pointerdown", handleOutsideClick);
        return () => {
            window.removeEventListener("pointerdown", handleOutsideClick);
        };
    });

    function exportBoard() {
        try {
            const dataStr = JSON.stringify(
                {
                    version: 1,
                    lines: boardData.lines,
                    zoom: boardData.zoom,
                    offsetX: boardData.offsetX,
                    offsetY: boardData.offsetY,
                },
                null,
                2,
            );

            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            const date = new Date();
            const timestamp = date.toISOString().split("T")[0];
            a.download = `kvoka-board-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();

            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            closeMenu();
        } catch (err) {
            console.error("Failed to export board:", err);
            alert("Помилка під час експортування дошки.");
        }
    }

    function triggerImport() {
        isBgOpen = false;
        isPanelsOpen = false;
        fileInput.click();
    }

    function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);

                if (!parsed || !Array.isArray(parsed.lines)) {
                    alert("Неправильний формат файлу дошки.");
                    return;
                }

                // Зберігаємо поточний стан дошки в історію перед перезаписом
                saveState();

                // Оновлюємо дані дошки
                boardData.lines = parsed.lines;

                if (typeof parsed.zoom === "number") {
                    boardData.zoom = parsed.zoom;
                } else {
                    boardData.zoom = 1;
                }

                if (typeof parsed.offsetX === "number") {
                    boardData.offsetX = parsed.offsetX;
                } else {
                    boardData.offsetX = 0;
                }

                if (typeof parsed.offsetY === "number") {
                    boardData.offsetY = parsed.offsetY;
                } else {
                    boardData.offsetY = 0;
                }

                closeMenu();
            } catch (err) {
                console.error("Failed to import board:", err);
                alert("Помилка під час імпортування файлу.");
            } finally {
                fileInput.value = "";
            }
        };
        reader.readAsText(file);
    }

    function enterPdfMode() {
        boardData.isPdfMode = true;
        boardData.selectedLineIds = [];
        closeMenu();

        if (boardData.pdfFrames.length === 0) {
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            const canvasX =
                (screenCenterX - boardData.offsetX) / boardData.zoom;
            const canvasY =
                (screenCenterY - boardData.offsetY) / boardData.zoom;
            const defWidth = 297.5;
            const defHeight = 421;

            boardData.pdfFrames = [
                {
                    id: Date.now() + Math.random(),
                    x: canvasX - defWidth / 2,
                    y: canvasY - defHeight / 2,
                    width: defWidth,
                    height: defHeight,
                    isVertical: true,
                    number: 1,
                },
            ];
        }
    }

    async function exitBoard() {
        if (confirm("Ви впевнені, що хочете вийти? Поточна дошка буде очищена і видалена зі збережених.")) {
            try {
                await deleteBoardFromDB();
                boardData.lines = [];
                boardData.zoom = 1;
                boardData.offsetX = 0;
                boardData.offsetY = 0;
                closeMenu();
                window.close();
            } catch (err) {
                console.error("Failed to exit and clear db:", err);
                alert("Помилка при виході.");
            }
        }
    }

    // --- Фон ---
    const overlayOptions = [
        { value: "none", label: "Немає", icon: "none" },
        { value: "grid", label: "Клітинка", icon: "grid" },
        { value: "lines", label: "Лінія", icon: "lines" },
        { value: "diagonal", label: "Коса лінія", icon: "diagonal" },
        { value: "dots", label: "Точки", icon: "dots" },
        { value: "draft", label: "Креслення", icon: "draft" },
    ];

    function handleOverlayColorChange(e) {
        bgSettings.overlayColor = e.target.value;
        saveBgSettings();
    }

    function handleBgColorChange(e) {
        bgSettings.bgColor = e.target.value;
        saveBgSettings();
    }

    function handleScaleInput(e) {
        bgSettings.scale = Number(e.target.value);
        saveBgSettings();
    }

    function selectOverlay(value) {
        bgSettings.overlay = value;
        saveBgSettings();
    }

    function resetBgSettings() {
        bgSettings.overlay = "none";
        bgSettings.scale = 40;
        bgSettings.overlayColor = "#d0d8e8";
        bgSettings.bgColor = "#ffffff";
        saveBgSettings();
    }

    // --- Панелі ---
    function savePanelsData() {
        savePanelsToDB({
            panels: $state.snapshot(customPanelsData.panels),
            isMainToolbarVisible: customPanelsData.isMainToolbarVisible
        }).catch(console.error);
    }

    function createPanel() {
        const newPanel = {
            id: Date.now() + Math.random(),
            name: "Нова панель",
            posX: window.innerWidth / 2 - 30,
            posY: window.innerHeight / 2 - 100,
            isVertical: true,
            isVisible: true,
            tools: []
        };
        customPanelsData.panels = [...customPanelsData.panels, newPanel];
        savePanelsData();
    }

    function deletePanel(id) {
        customPanelsData.panels = customPanelsData.panels.filter(p => p.id !== id);
        savePanelsData();
        deletingPanelId = null;
    }

    function togglePanelVisibility(panel) {
        panel.isVisible = !panel.isVisible;
        savePanelsData();
    }

    function toggleMainToolbarVisibility() {
        customPanelsData.isMainToolbarVisible = !customPanelsData.isMainToolbarVisible;
        savePanelsData();
    }

    let editingPanelId = $state(null);
    let editingName = $state("");
    let deletingPanelId = $state(null);
    let draggedPanelId = $state(null);

    function handleDragStartPanel(e, panelId) {
        draggedPanelId = panelId;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(panelId));
            // Приховуємо стандартний ghost браузера
            const ghost = document.createElement('canvas');
            ghost.width = 1;
            ghost.height = 1;
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 0, 0);
            requestAnimationFrame(() => document.body.removeChild(ghost));
        }
    }

    function handleDragEnterPanel(e, targetPanelId) {
        if (draggedPanelId && draggedPanelId !== targetPanelId) {
            const panels = customPanelsData.panels;
            const fromIndex = panels.findIndex(p => p.id === draggedPanelId);
            const toIndex = panels.findIndex(p => p.id === targetPanelId);
            if (fromIndex === -1 || toIndex === -1) return;
            const newPanels = [...panels];
            newPanels.splice(fromIndex, 1);
            newPanels.splice(toIndex, 0, panels[fromIndex]);
            customPanelsData.panels = newPanels;
        }
    }

    function handleDragOverPanel(e) {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    }

    function handleDropPanel(e) {
        e.preventDefault();
        savePanelsData();
        draggedPanelId = null;
    }

    function handleDragEndPanel() {
        savePanelsData();
        draggedPanelId = null;
    }

    function startRename(panel, e) {
        e.stopPropagation();
        editingPanelId = panel.id;
        editingName = panel.name;
    }

    function commitRename(panel) {
        const trimmed = editingName.trim();
        if (trimmed !== "") {
            panel.name = trimmed;
            savePanelsData();
        }
        editingPanelId = null;
    }

    function cancelRename() {
        editingPanelId = null;
    }

    function requestDelete(id, e) {
        e.stopPropagation();
        deletingPanelId = id;
    }

    function confirmDelete() {
        deletePanel(deletingPanelId);
    }

    function cancelDelete(e) {
        e?.stopPropagation();
        deletingPanelId = null;
    }
</script>

<div class="menu-container" bind:this={menuContainer}>
    <button
        id="menu-button"
        class="menu-btn"
        class:active={isOpen}
        onclick={toggleMenu}
        title="Меню"
        aria-label="Меню керування дошкою"
    >
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
    </button>

    {#if isOpen}
        <div id="menu-dropdown" class="dropdown-menu">
            <!-- Пункт Фон з підменю (першим) -->
            <div class="submenu-wrapper" class:submenu-open={isBgOpen}>
                <button
                    id="bg-option"
                    class="dropdown-item submenu-trigger"
                    class:active={isBgOpen}
                    onclick={() => { isPanelsOpen = false; isBgOpen = !isBgOpen; }}
                >
                    <svg
                        class="item-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"
                        ></rect>
                        <path d="M3 9h18"></path>
                        <path d="M9 21V9"></path>
                    </svg>
                    <span>Фон</span>
                    <svg
                        class="chevron"
                        class:rotated={isBgOpen}
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>

                {#if isBgOpen}
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <div
                        id="bg-submenu"
                        class="bg-submenu"
                        onpointerdown={(e) => e.stopPropagation()}
                    >
                        <!-- Накладка -->
                        <div class="submenu-section">
                            <div class="submenu-label">Накладка</div>
                            <div class="overlay-grid">
                                {#each overlayOptions as opt}
                                    <button
                                        class="overlay-btn"
                                        class:selected={bgSettings.overlay ===
                                            opt.value}
                                        onclick={() => selectOverlay(opt.value)}
                                        title={opt.label}
                                        aria-label={opt.label}
                                    >
                                        <span class="overlay-icon">
                                            {#if opt.icon === "none"}
                                                <svg
                                                    width="22"
                                                    height="22"
                                                    viewBox="0 0 22 22"
                                                    ><rect
                                                        x="1"
                                                        y="1"
                                                        width="20"
                                                        height="20"
                                                        rx="3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="1.5"
                                                    /><line
                                                        x1="5"
                                                        y1="17"
                                                        x2="17"
                                                        y2="5"
                                                        stroke="currentColor"
                                                        stroke-width="1.5"
                                                    /></svg
                                                >
                                            {:else if opt.icon === "grid"}
                                                <svg
                                                    width="22"
                                                    height="22"
                                                    viewBox="0 0 22 22"
                                                    ><rect
                                                        x="1"
                                                        y="1"
                                                        width="20"
                                                        height="20"
                                                        rx="3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="1.5"
                                                    /><line
                                                        x1="1"
                                                        y1="8"
                                                        x2="21"
                                                        y2="8"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /><line
                                                        x1="1"
                                                        y1="14"
                                                        x2="21"
                                                        y2="14"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /><line
                                                        x1="8"
                                                        y1="1"
                                                        x2="8"
                                                        y2="21"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /><line
                                                        x1="14"
                                                        y1="1"
                                                        x2="14"
                                                        y2="21"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /></svg
                                                >
                                            {:else if opt.icon === "lines"}
                                                <svg
                                                    width="22"
                                                    height="22"
                                                    viewBox="0 0 22 22"
                                                    ><rect
                                                        x="1"
                                                        y="1"
                                                        width="20"
                                                        height="20"
                                                        rx="3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="1.5"
                                                    /><line
                                                        x1="1"
                                                        y1="7"
                                                        x2="21"
                                                        y2="7"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /><line
                                                        x1="1"
                                                        y1="11"
                                                        x2="21"
                                                        y2="11"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /><line
                                                        x1="1"
                                                        y1="15"
                                                        x2="21"
                                                        y2="15"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /></svg
                                                >
                                            {:else if opt.icon === "diagonal"}
                                                <svg
                                                    width="22"
                                                    height="22"
                                                    viewBox="0 0 22 22"
                                                    ><rect
                                                        x="1"
                                                        y="1"
                                                        width="20"
                                                        height="20"
                                                        rx="3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="1.5"
                                                    /><line
                                                        x1="1"
                                                        y1="7"
                                                        x2="21"
                                                        y2="7"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /><line
                                                        x1="1"
                                                        y1="14"
                                                        x2="21"
                                                        y2="14"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /><line
                                                        x1="3"
                                                        y1="1"
                                                        x2="9"
                                                        y2="21"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /><line
                                                        x1="13"
                                                        y1="1"
                                                        x2="19"
                                                        y2="21"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /></svg
                                                >
                                            {:else if opt.icon === "dots"}
                                                <svg
                                                    width="22"
                                                    height="22"
                                                    viewBox="0 0 22 22"
                                                    ><rect
                                                        x="1"
                                                        y="1"
                                                        width="20"
                                                        height="20"
                                                        rx="3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="1.5"
                                                    /><circle
                                                        cx="7"
                                                        cy="7"
                                                        r="1.5"
                                                        fill="currentColor"
                                                    /><circle
                                                        cx="15"
                                                        cy="7"
                                                        r="1.5"
                                                        fill="currentColor"
                                                    /><circle
                                                        cx="7"
                                                        cy="15"
                                                        r="1.5"
                                                        fill="currentColor"
                                                    /><circle
                                                        cx="15"
                                                        cy="15"
                                                        r="1.5"
                                                        fill="currentColor"
                                                    /><circle
                                                        cx="11"
                                                        cy="11"
                                                        r="1.5"
                                                        fill="currentColor"
                                                    /></svg
                                                >
                                            {:else if opt.icon === "draft"}
                                                <svg
                                                    width="22"
                                                    height="22"
                                                    viewBox="0 0 22 22"
                                                    ><rect
                                                        x="1"
                                                        y="1"
                                                        width="20"
                                                        height="20"
                                                        rx="3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-width="1.5"
                                                    /><line
                                                        x1="1"
                                                        y1="5"
                                                        x2="21"
                                                        y2="5"
                                                        stroke="currentColor"
                                                        stroke-width="0.5"
                                                        opacity="0.5"
                                                    /><line
                                                        x1="1"
                                                        y1="9"
                                                        x2="21"
                                                        y2="9"
                                                        stroke="currentColor"
                                                        stroke-width="0.5"
                                                        opacity="0.5"
                                                    /><line
                                                        x1="1"
                                                        y1="13"
                                                        x2="21"
                                                        y2="13"
                                                        stroke="currentColor"
                                                        stroke-width="0.5"
                                                        opacity="0.5"
                                                    /><line
                                                        x1="1"
                                                        y1="17"
                                                        x2="21"
                                                        y2="17"
                                                        stroke="currentColor"
                                                        stroke-width="0.5"
                                                        opacity="0.5"
                                                    /><line
                                                        x1="5"
                                                        y1="1"
                                                        x2="5"
                                                        y2="21"
                                                        stroke="currentColor"
                                                        stroke-width="0.5"
                                                        opacity="0.5"
                                                    /><line
                                                        x1="9"
                                                        y1="1"
                                                        x2="9"
                                                        y2="21"
                                                        stroke="currentColor"
                                                        stroke-width="0.5"
                                                        opacity="0.5"
                                                    /><line
                                                        x1="13"
                                                        y1="1"
                                                        x2="13"
                                                        y2="21"
                                                        stroke="currentColor"
                                                        stroke-width="0.5"
                                                        opacity="0.5"
                                                    /><line
                                                        x1="17"
                                                        y1="1"
                                                        x2="17"
                                                        y2="21"
                                                        stroke="currentColor"
                                                        stroke-width="0.5"
                                                        opacity="0.5"
                                                    /><line
                                                        x1="1"
                                                        y1="1"
                                                        x2="21"
                                                        y2="21"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /><line
                                                        x1="1"
                                                        y1="21"
                                                        x2="21"
                                                        y2="1"
                                                        stroke="currentColor"
                                                        stroke-width="1"
                                                    /></svg
                                                >
                                            {/if}
                                        </span>
                                        <span class="overlay-label"
                                            >{opt.label}</span
                                        >
                                    </button>
                                {/each}
                            </div>
                        </div>

                        <!-- Масштаб накладки -->
                        <div class="submenu-section">
                            <div class="submenu-label">
                                Масштаб накладки
                                <span class="scale-value"
                                    >{bgSettings.scale} px</span
                                >
                            </div>
                            <div class="scale-row">
                                <span class="scale-hint">10</span>
                                <input
                                    id="bg-scale-slider"
                                    type="range"
                                    min="10"
                                    max="200"
                                    step="5"
                                    value={bgSettings.scale}
                                    oninput={handleScaleInput}
                                    class="scale-slider"
                                    disabled={bgSettings.overlay === "none"}
                                />
                                <span class="scale-hint">200</span>
                            </div>
                        </div>

                        <!-- Колір накладки -->
                        <div class="submenu-section">
                            <div class="submenu-label">Колір накладки</div>
                            <div class="color-row">
                                <div
                                    class="color-swatch-preview"
                                    style="background: {bgSettings.overlayColor};"
                                ></div>
                                <label class="color-label">
                                    <span class="color-hex"
                                        >{bgSettings.overlayColor}</span
                                    >
                                    <input
                                        id="bg-overlay-color"
                                        type="color"
                                        value={bgSettings.overlayColor}
                                        oninput={handleOverlayColorChange}
                                        class="native-color-input"
                                        disabled={bgSettings.overlay === "none"}
                                    />
                                </label>
                            </div>
                        </div>

                        <!-- Колір фону -->
                        <div class="submenu-section">
                            <div class="submenu-label">Колір фону</div>
                            <div class="color-row">
                                <div
                                    class="color-swatch-preview"
                                    style="background: {bgSettings.bgColor}; border: 1px solid #ccc;"
                                ></div>
                                <label class="color-label">
                                    <span class="color-hex"
                                        >{bgSettings.bgColor}</span
                                    >
                                    <input
                                        id="bg-fill-color"
                                        type="color"
                                        value={bgSettings.bgColor}
                                        oninput={handleBgColorChange}
                                        class="native-color-input"
                                    />
                                </label>
                            </div>
                        </div>

                        <!-- Роздільник та кнопка Скинути -->
                        <div class="divider"></div>
                        <button class="reset-bg-btn" onclick={resetBgSettings}
                            >Скинути</button
                        >
                    </div>
                {/if}
            </div>

            <!-- Пункт Панелі з підменю -->
            <div class="submenu-wrapper" class:submenu-open={isPanelsOpen}>
                <button
                    class="dropdown-item submenu-trigger"
                    class:active={isPanelsOpen}
                    onclick={() => { isBgOpen = false; isPanelsOpen = !isPanelsOpen; }}
                >
                    <svg
                        class="item-icon"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="9" y1="3" x2="9" y2="21"></line>
                    </svg>
                    <span>Панелі</span>
                    <svg
                        class="chevron"
                        class:rotated={isPanelsOpen}
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>

                {#if isPanelsOpen}
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <div
                        class="bg-submenu panels-submenu"
                        onpointerdown={(e) => e.stopPropagation()}
                    >
                        <button class="create-panel-btn" onclick={createPanel}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Створити панель
                        </button>
                        <div class="divider"></div>
                        
                        <div class="panels-list">
                            <div class="panel-item" onclick={toggleMainToolbarVisibility} title={customPanelsData.isMainToolbarVisible ? 'Сховати' : 'Показати'} class:panel-hidden={!customPanelsData.isMainToolbarVisible}>
                                <span class="panel-name-text">Основна панель</span>
                            </div>

                            {#each customPanelsData.panels as panel (panel.id)}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                class="panel-item"
                                class:panel-hidden={!panel.isVisible}
                                class:is-dragging={draggedPanelId === panel.id}
                                draggable="true"
                                ondragstart={(e) => handleDragStartPanel(e, panel.id)}
                                ondragenter={(e) => handleDragEnterPanel(e, panel.id)}
                                ondragover={handleDragOverPanel}
                                ondrop={handleDropPanel}
                                ondragend={handleDragEndPanel}
                                onclick={() => { if (editingPanelId !== panel.id) togglePanelVisibility(panel); }}
                            >
                                {#if editingPanelId === panel.id}
                                    <!-- svelte-ignore a11y_autofocus -->
                                    <input
                                        class="panel-name-input"
                                        type="text"
                                        bind:value={editingName}
                                        autofocus
                                        onclick={(e) => e.stopPropagation()}
                                        onkeydown={(e) => { if (e.key === 'Enter') commitRename(panel); else if (e.key === 'Escape') cancelRename(); }}
                                        onblur={() => commitRename(panel)}
                                    />
                                {:else}
                                    <span class="panel-name-text">{panel.name}</span>
                                {/if}
                                <div class="panel-actions">
                                    <button class="panel-icon-btn" onclick={(e) => startRename(panel, e)} title="Перейменувати">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <div class="panel-delete-wrap">
                                        <button class="panel-icon-btn panel-delete-btn" onclick={(e) => requestDelete(panel.id, e)} title="Видалити">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                        {#if deletingPanelId === panel.id}
                                            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                            <div class="delete-popup" onpointerdown={(e) => e.stopPropagation()}>
                                                <div class="delete-popup-text">Видалити панель?</div>
                                                <div class="delete-popup-actions">
                                                    <button class="del-confirm-btn" onclick={confirmDelete}>Так</button>
                                                    <button class="del-cancel-btn" onclick={cancelDelete}>Ні</button>
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/each}
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Роздільник -->
            <div class="divider"></div>

            <button
                id="import-option"
                class="dropdown-item"
                onclick={triggerImport}
            >
                <svg
                    class="item-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>Завантажити дошку</span>
            </button>

            <button
                id="export-option"
                class="dropdown-item"
                onclick={exportBoard}
            >
                <svg
                    class="item-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Зберегти дошку</span>
            </button>

            <button
                id="pdf-export-option"
                class="dropdown-item"
                onclick={enterPdfMode}
            >
                <svg
                    class="item-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    ></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <circle cx="10" cy="9" r="1"></circle>
                </svg>
                <span>Експортувати як PDF</span>
            </button>

            <button
                id="ruler-option"
                class="dropdown-item"
                onclick={() => { addRuler(); closeMenu(); }}
            >
                <svg
                    class="item-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                    <line x1="6" y1="6" x2="6" y2="12"></line>
                    <line x1="10" y1="6" x2="10" y2="10"></line>
                    <line x1="14" y1="6" x2="14" y2="12"></line>
                    <line x1="18" y1="6" x2="18" y2="10"></line>
                </svg>
                <span>Лінійка</span>
            </button>

            <button
                id="setsquare-option"
                class="dropdown-item"
                onclick={() => { addSetSquare(); closeMenu(); }}
            >
                <svg
                    class="item-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polygon points="3,3 21,21 3,21"></polygon>
                    <line x1="7" y1="21" x2="7" y2="18"></line>
                    <line x1="11" y1="21" x2="11" y2="18"></line>
                    <line x1="15" y1="21" x2="15" y2="18"></line>
                    <line x1="3" y1="17" x2="6" y2="17"></line>
                    <line x1="3" y1="13" x2="6" y2="13"></line>
                    <line x1="3" y1="9" x2="6" y2="9"></line>
                </svg>
                <span>Косинець</span>
            </button>

            <!-- Роздільник -->
            <div class="divider"></div>

            <button
                id="exit-option"
                class="dropdown-item"
                onclick={exitBoard}
                style="color: #dc3545;"
            >
                <svg
                    class="item-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Вийти</span>
            </button>
        </div>
    {/if}
</div>

<input
    type="file"
    bind:this={fileInput}
    accept=".json"
    onchange={handleImport}
    style="display: none;"
/>

<style>
    .menu-container {
        position: fixed;
        bottom: 10px;
        left: 10px;
        z-index: 1001;
        display: inline-block;
    }

    .menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.08),
            0 1px 3px rgba(0, 0, 0, 0.05);
        color: #333333;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 0;
        outline: none;
    }

    .menu-btn:hover {
        background: #ffffff;
        transform: scale(1.05);
        box-shadow:
            0 6px 16px rgba(0, 0, 0, 0.12),
            0 2px 4px rgba(0, 0, 0, 0.06);
        border-color: rgba(0, 123, 255, 0.3);
        color: #007bff;
    }

    .menu-btn:active {
        transform: scale(0.95);
    }

    .menu-btn.active {
        background: #007bff;
        color: #ffffff;
        border-color: #007bff;
        box-shadow: 0 0 12px rgba(0, 123, 255, 0.4);
    }

    .panel-item.is-dragging {
        opacity: 0.4;
        outline: 1.5px dashed rgba(0, 123, 255, 0.5);
    }

    .panel-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.15s ease, opacity 0.15s ease;
    }

    .panel-item:hover {
        background: rgba(0, 123, 255, 0.06);
    }

    .panel-item.panel-hidden {
        opacity: 0.45;
    }

    .panel-name-text {
        flex-grow: 1;
        font-size: 13px;
        font-weight: 500;
        color: #333;
        white-space: normal;
        word-break: break-word;
        line-height: 1.35;
    }

    .panel-name-input {
        flex-grow: 1;
        font-size: 13px;
        font-weight: 500;
        color: #333;
        background: rgba(0, 123, 255, 0.06);
        border: 1.5px solid rgba(0, 123, 255, 0.35);
        border-radius: 6px;
        padding: 2px 6px;
        outline: none;
        line-height: 1.4;
        min-width: 0;
        width: 100%;
        box-sizing: border-box;
        transition: border-color 0.15s;
    }

    .panel-name-input:focus {
        border-color: #007bff;
        background: rgba(0, 123, 255, 0.09);
    }

    .panel-actions {
        display: flex;
        gap: 2px;
        align-items: center;
        flex-shrink: 0;
    }

    .panel-delete-wrap {
        position: relative;
    }

    .delete-popup {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1200;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 150px;
    }

    .delete-popup-text {
        font-size: 13px;
        color: #333;
        text-align: center;
        font-weight: 500;
    }

    .delete-popup-actions {
        display: flex;
        gap: 8px;
    }

    .del-confirm-btn,
    .del-cancel-btn {
        flex: 1;
        padding: 7px 10px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .del-confirm-btn {
        background-color: #ffebee;
        color: #d32f2f;
    }

    .del-confirm-btn:hover {
        background-color: #ffcdd2;
    }

    .del-cancel-btn {
        background-color: #f5f5f5;
        color: #333;
    }

    .del-cancel-btn:hover {
        background-color: #e0e0e0;
    }

    .panel-icon-btn {
        background: none;
        border: none;
        color: #6c757d;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 5px;
        width: 24px;
        height: 24px;
        transition: background 0.15s, color 0.15s;
    }

    .panel-icon-btn:hover {
        background: rgba(0, 123, 255, 0.1);
        color: #007bff;
    }

    .panel-icon-btn.panel-delete-btn:hover {
        background: rgba(220, 53, 69, 0.1);
        color: #dc3545;
    }

    .create-panel-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 12px;
        background: rgba(25, 135, 84, 0.08);
        border: 1px solid rgba(25, 135, 84, 0.3);
        border-radius: 8px;
        color: #198754;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .create-panel-btn:hover {
        background: rgba(25, 135, 84, 0.15);
        border-color: rgba(25, 135, 84, 0.5);
        color: #146c43;
    }

    .create-panel-btn:active {
        background: rgba(25, 135, 84, 0.22);
        transform: scale(0.98);
    }

    .dropdown-menu {
        position: absolute;
        bottom: 52px;
        left: 0;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        box-shadow:
            0 10px 25px rgba(0, 0, 0, 0.1),
            0 3px 10px rgba(0, 0, 0, 0.05);
        border-radius: 12px;
        padding: 6px;
        min-width: 210px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        animation: slideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: bottom left;
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: scale(0.9) translateY(10px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }

    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 14px;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: #333333;
        font-size: 14px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s ease;
        box-sizing: border-box;
    }

    .dropdown-item:hover {
        background: rgba(0, 123, 255, 0.08);
        color: #007bff;
        padding-left: 18px;
    }

    .dropdown-item:active {
        background: rgba(0, 123, 255, 0.15);
    }

    .dropdown-item.active {
        background: rgba(0, 123, 255, 0.08);
        color: #007bff;
    }

    .item-icon {
        flex-shrink: 0;
        transition: transform 0.2s ease;
    }

    .dropdown-item:hover .item-icon {
        transform: translateY(1px);
    }

    .divider {
        height: 1px;
        background: rgba(0, 0, 0, 0.06);
        margin: 4px 8px;
        flex-shrink: 0;
    }

    /* Submenu trigger */
    .submenu-trigger {
        position: relative;
    }

    .submenu-trigger span:first-of-type {
        flex: 1;
    }

    .chevron {
        margin-left: auto;
        flex-shrink: 0;
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0.5;
    }

    .chevron.rotated {
        transform: rotate(90deg);
        opacity: 1;
    }

    /* Bg Submenu panel */
    .submenu-wrapper {
        position: relative;
    }

    .bg-submenu {
        position: absolute;
        left: calc(100% + 8px);
        bottom: 0;
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow:
            0 12px 32px rgba(0, 0, 0, 0.12),
            0 3px 10px rgba(0, 0, 0, 0.06);
        border-radius: 14px;
        padding: 14px;
        width: 240px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        animation: fadeInLeft 0.18s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: bottom left;
        z-index: 1100;
    }

    @keyframes fadeInLeft {
        from {
            opacity: 0;
            transform: translateX(8px) scale(0.96);
        }
        to {
            opacity: 1;
            transform: translateX(0) scale(1);
        }
    }

    .submenu-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .submenu-label {
        font-size: 11px;
        font-weight: 700;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    /* Overlay picker grid */
    .overlay-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
    }

    .overlay-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 6px 4px;
        background: transparent;
        border: 1.5px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        color: #555;
        transition: all 0.18s ease;
        font-size: 10px;
        font-weight: 500;
    }

    .overlay-btn:hover {
        background: rgba(0, 123, 255, 0.07);
        color: #007bff;
        border-color: rgba(0, 123, 255, 0.2);
    }

    .overlay-btn.selected {
        background: rgba(0, 123, 255, 0.12);
        border-color: #007bff;
        color: #007bff;
    }

    .overlay-icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .overlay-label {
        line-height: 1.2;
        text-align: center;
    }

    /* Scale slider */
    .scale-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .scale-hint {
        font-size: 10px;
        color: #aaa;
        flex-shrink: 0;
        width: 24px;
        text-align: center;
    }

    .scale-slider {
        flex: 1;
        height: 4px;
        appearance: none;
        -webkit-appearance: none;
        background: linear-gradient(
            to right,
            #007bff 0%,
            #007bff calc((var(--val, 40) - 10) / 190 * 100%),
            #e0e0e0 calc((var(--val, 40) - 10) / 190 * 100%)
        );
        border-radius: 4px;
        outline: none;
        cursor: pointer;
    }

    .scale-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #007bff;
        border: 2px solid #fff;
        box-shadow: 0 1px 4px rgba(0, 123, 255, 0.4);
        cursor: pointer;
        transition: transform 0.15s ease;
    }

    .scale-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
    }

    .scale-slider:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .scale-value {
        font-size: 11px;
        color: #007bff;
        font-weight: 600;
    }

    /* Color row */
    .color-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 8px;
        border: 1px solid rgba(0, 0, 0, 0.06);
    }

    .color-swatch-preview {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        flex-shrink: 0;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.15);
    }

    .color-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex: 1;
        cursor: pointer;
        gap: 6px;
    }

    .color-hex {
        font-size: 12px;
        color: #555;
        font-family: monospace;
        flex: 1;
    }

    .native-color-input {
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        background: none;
        flex-shrink: 0;
    }

    .native-color-input::-webkit-color-swatch-wrapper {
        padding: 0;
    }

    .native-color-input::-webkit-color-swatch {
        border: 1.5px solid rgba(0, 0, 0, 0.15);
        border-radius: 6px;
    }

    .native-color-input:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    /* Reset button */
    .reset-bg-btn {
        width: 100%;
        padding: 8px;
        background: transparent;
        border: 1px solid rgba(255, 59, 48, 0.2);
        border-radius: 8px;
        color: #ff3b30;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: 4px;
    }

    .reset-bg-btn:hover {
        background: rgba(255, 59, 48, 0.08);
        border-color: rgba(255, 59, 48, 0.4);
    }
</style>
