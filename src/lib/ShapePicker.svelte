<script>
    import { onMount, tick } from "svelte";
    import { brushSettings } from "$lib";

    let {
        isVertical = true,
        disabled = false,
        onToolSelect,
        onChange,
        onStartEdit,
    } = $props();

    let isOpen = $state(false);
    let pickerElement;
    let popupStyle = $state("top: 0; left: calc(100% + 12px); right: auto; bottom: auto;");

    // Helper for creating simple SVGs
    const iconBase = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
    const iconEnd = `</svg>`;

    const categories = [
        {
            title: "Основні",
            shapes: [
                { id: "line", name: "Лінія", icon: `${iconBase}<line x1="5" y1="12" x2="19" y2="12" />${iconEnd}` },
                { id: "dashed_line", name: "Пунктирна лінія", icon: `${iconBase}<line x1="5" y1="12" x2="19" y2="12" stroke-dasharray="4 4" />${iconEnd}` },
                { id: "arrow", name: "Стрілка", icon: `${iconBase}<line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />${iconEnd}` }
            ]
        },
        {
            title: "Пропорційні",
            shapes: [
                { id: "circle", name: "Коло", icon: `${iconBase}<circle cx="12" cy="12" r="8" />${iconEnd}` },
                { id: "square", name: "Квадрат", icon: `${iconBase}<rect x="4" y="4" width="16" height="16" />${iconEnd}` },
                { id: "equilateral_triangle", name: "Рівносторонній трикутник", icon: `${iconBase}<polygon points="12 4 4 19 20 19" />${iconEnd}` }
            ]
        },
        {
            title: "Інші 2D",
            shapes: [
                { id: "ellipse", name: "Еліпс", icon: `${iconBase}<ellipse cx="12" cy="12" rx="10" ry="6" />${iconEnd}` },
                { id: "rectangle", name: "Прямокутник", icon: `${iconBase}<rect x="3" y="6" width="18" height="12" />${iconEnd}` },
                { id: "triangle", name: "Трикутник", icon: `${iconBase}<polygon points="12 4 3 20 21 20" />${iconEnd}` },
                { id: "right_triangle", name: "Прямокутний трикутник", icon: `${iconBase}<polygon points="4 4 4 20 20 20" />${iconEnd}` },
                { id: "trapezoid", name: "Трапеція", icon: `${iconBase}<polygon points="7 6 17 6 21 18 3 18" />${iconEnd}` },
                { id: "parallelogram", name: "Паралелограм", icon: `${iconBase}<polygon points="8 6 22 6 16 18 2 18" />${iconEnd}` }
            ]
        },
        {
            title: "3D фігури",
            shapes: [
                // Для 3D генеруємо спрощені іконки (ізометрія/псевдо-3D)
                { id: "cube", name: "Куб", icon: `${iconBase}<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />${iconEnd}` },
                { id: "parallelepiped", name: "Паралелепіпед", icon: `${iconBase}<polygon points="4 8 16 8 20 12 8 12" /><polygon points="4 8 4 18 8 22 8 12" /><polygon points="8 22 20 18 20 12 8 12" />${iconEnd}` },
                { id: "cylinder", name: "Циліндр", icon: `${iconBase}<ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />${iconEnd}` },
                { id: "cone", name: "Конус", icon: `${iconBase}<ellipse cx="12" cy="18" rx="8" ry="3" /><path d="M4 18L12 4l8 14" />${iconEnd}` }
            ]
        }
    ];

    const fillColors = [
        "#000000",
        "#808080",
        "#ffffff",
        "#ff0000",
        "#ffa500",
        "#ffff00",
        "#0000ff",
        "#008000",
        "#800080",
    ];

    onMount(() => {
        const handleOutsideClick = (e) => {
            if (isOpen && pickerElement && !pickerElement.contains(e.target)) {
                isOpen = false;
            }
        };

        window.addEventListener("pointerdown", handleOutsideClick);
        return () => window.removeEventListener("pointerdown", handleOutsideClick);
    });

    async function computePopupStyle() {
        await tick();
        if (!pickerElement) return;
        const rect = pickerElement.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (isVertical) {
            if (rect.left < vw / 2) {
                popupStyle = "top: 0; bottom: auto; left: calc(100% + 12px); right: auto;";
            } else {
                popupStyle = "top: 0; bottom: auto; right: calc(100% + 12px); left: auto;";
            }
        } else {
            if (rect.top < vh / 2) {
                popupStyle = "top: calc(100% + 12px); bottom: auto; left: 50%; right: auto; transform: translateX(-50%);";
            } else {
                popupStyle = "bottom: calc(100% + 12px); top: auto; left: 50%; right: auto; transform: translateX(-50%);";
            }
        }
    }

    function togglePopup() {
        if (disabled) return;
        
        // Якщо панель не відкрита, але інструмент не 'shape', спочатку перемикаємось на shape,
        // але панель також потрібно відкривати по кліку, щоб вибрати фігуру
        if (brushSettings.tool !== 'shape') {
            if (onToolSelect) onToolSelect('shape');
            brushSettings.tool = 'shape';
        }

        isOpen = !isOpen;
        if (isOpen) computePopupStyle();
    }

    function selectShape(shapeId) {
        brushSettings.shapeType = shapeId;
        if (brushSettings.tool !== 'shape') {
            if (onToolSelect) onToolSelect('shape');
            brushSettings.tool = 'shape';
        }
        isOpen = false;
    }

    function selectFill(color) {
        if (onStartEdit) onStartEdit();
        brushSettings.fillColor = color;
        if (onChange) onChange();
    }

    // Знайдемо поточну іконку
    const currentShapeIcon = $derived.by(() => {
        for (const cat of categories) {
            const sh = cat.shapes.find(s => s.id === brushSettings.shapeType);
            if (sh) return sh.icon;
        }
        return categories[0].shapes[0].icon;
    });

</script>

<div class="shape-picker-container" bind:this={pickerElement}>
    <button
        class="shape-btn"
        class:active={brushSettings.tool === 'shape'}
        onclick={togglePopup}
        {disabled}
        title="Фігури"
        aria-label="Вибрати фігуру"
    >
        <div class="icon-wrapper">
            {@html currentShapeIcon}
        </div>
    </button>

    {#if isOpen}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="popup" style={popupStyle} onpointerdown={(e) => e.stopPropagation()}>
            {#each categories as category}
                <div class="section-title">{category.title}</div>
                <div class="shape-grid">
                    {#each category.shapes as shape}
                        <button
                            class="shape-swatch"
                            class:selected={brushSettings.shapeType === shape.id}
                            onclick={() => selectShape(shape.id)}
                            title={shape.name}
                            aria-label={shape.name}
                        >
                            {@html shape.icon}
                        </button>
                    {/each}
                </div>
            {/each}

            <div class="section-title">Заливка</div>
            <div class="fill-grid">
                <button
                    class="fill-swatch none"
                    class:selected={!brushSettings.fillColor}
                    onclick={() => selectFill(null)}
                    title="Без заливки"
                    aria-label="Без заливки"
                ></button>
                {#each fillColors as c}
                    <button
                        class="fill-swatch"
                        style="background-color: {c};"
                        class:selected={brushSettings.fillColor === c}
                        onclick={() => selectFill(c)}
                        title={c}
                        aria-label="Заливка {c}"
                    ></button>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .shape-picker-container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .shape-btn {
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
    }

    .shape-btn:hover:not(:disabled) {
        background-color: #c7dff9;
    }

    .shape-btn.active {
        background-color: #007bff;
        color: white;
    }
    
    .shape-btn.active .icon-wrapper {
        filter: invert(1);
    }

    .shape-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .icon-wrapper {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: inherit;
    }

    .popup {
        position: absolute;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        padding: 12px;
        z-index: 1010;
        width: 170px;
        border: 1px solid #eee;
        display: flex;
        flex-direction: column;
        gap: 12px;
        cursor: default;
        max-height: 80vh;
        overflow-y: auto;
    }

    .section-title {
        font-size: 11px;
        color: #777;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: -4px;
    }

    .shape-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        justify-items: center;
    }

    .shape-swatch {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        border: 1px solid transparent;
        background-color: transparent;
        cursor: pointer;
        padding: 0;
        transition: all 0.1s;
        color: #333;
    }

    .shape-swatch:hover:not(:disabled) {
        background-color: #f0f0f0;
        transform: scale(1.1);
    }

    .shape-swatch.selected {
        background-color: #e6f2ff;
        border-color: #007bff;
        color: #007bff;
        transform: scale(1.1);
    }

    .fill-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
        justify-items: center;
    }

    .fill-swatch {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 1px solid rgba(0, 0, 0, 0.15);
        cursor: pointer;
        padding: 0;
        transition: transform 0.1s;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .fill-swatch:hover {
        transform: scale(1.15);
    }

    .fill-swatch.selected {
        border: 2px solid #007bff;
        transform: scale(1.1);
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.3);
    }

    .fill-swatch.none {
        background: repeating-linear-gradient(
            45deg,
            #f0f0f0,
            #f0f0f0 3px,
            #e0e0e0 3px,
            #e0e0e0 6px
        );
        box-shadow: none;
        border: 1px dashed #ccc;
    }

    .fill-swatch.none.selected {
        border: 2px solid #007bff;
        border-style: solid;
    }
</style>
