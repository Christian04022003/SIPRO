import React, { useState, useRef, useEffect, useCallback } from 'react';
import GanttTable from './GanttTable';

// --- COMPONENTE PRINCIPAL: App con Split Resizer ---
function App() {
    // 1. Estado para el ancho del panel izquierdo (en porcentaje)
    const [leftPanelWidth, setLeftPanelWidth] = useState(50);
    // 2. Estado para saber si estamos arrastrando
    const [isResizing, setIsResizing] = useState(false);
    // 3. Referencia al contenedor principal para calcular los límites
    const containerRef = useRef(null);

    // --- LÓGICA DE REDIMENSIONAMIENTO ---

    // 4. Inicia el redimensionamiento al presionar el divisor
    const startResize = useCallback((e) => {
        setIsResizing(true);
        // Evita que se seleccione texto al arrastrar
        e.preventDefault();
    }, []);

    // 5. Detiene el redimensionamiento
    const stopResize = useCallback(() => {
        setIsResizing(false);
    }, []);

    // 6. Calcula el nuevo ancho mientras se arrastra
    const onResize = useCallback((e) => {
        if (!isResizing || !containerRef.current) return;

        // Obtener la posición X del ratón o toque
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;

        // Calcular el nuevo ancho en píxeles
        const containerBounds = containerRef.current.getBoundingClientRect();
        const newWidthPx = clientX - containerBounds.left;

        // Convertir a porcentaje
        const newWidthPercent = (newWidthPx / containerBounds.width) * 100;

        // Limitar entre 15% y 85% para evitar que un panel desaparezca
        if (newWidthPercent > 15 && newWidthPercent < 85) {
            setLeftPanelWidth(newWidthPercent);
        }
    }, [isResizing]);

    // 7. Conecta los eventos de movimiento y fin de arrastre a la ventana global
    useEffect(() => {
        if (isResizing) {
            // Eventos para mouse (escritorio)
            window.addEventListener('mousemove', onResize);
            window.addEventListener('mouseup', stopResize);
            // Eventos para touch (móvil)
            window.addEventListener('touchmove', onResize);
            window.addEventListener('touchend', stopResize);
        }
        return () => {
            // Limpia los listeners al desmontar o detener el arrastre
            window.removeEventListener('mousemove', onResize);
            window.removeEventListener('mouseup', stopResize);
            window.removeEventListener('touchmove', onResize);
            window.removeEventListener('touchend', stopResize);
        };
    }, [isResizing, onResize, stopResize]);


    // --- ESTILOS EN LÍNEA SIMPLIFICADOS (Mejor usar Tailwind directamente) ---

    // Estilo del contenedor principal
    const mainContainerStyle = {
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
    };

    // Estilo para el contenedor de los dos paneles
    const splitContainerStyle = {
        display: 'flex',
        flexDirection: 'row',
        height: '400px', // Altura fija para el ejemplo
        width: '90%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        borderRadius: '0.5rem',
        overflow: 'hidden',
    };

    // Estilo del divisor
    const splitterStyle = {
        width: '8px',
        backgroundColor: isResizing ? '#4f46e5' : '#ccc', // Morado al arrastrar
        cursor: 'col-resize',
        flexShrink: 0,
        transition: 'background-color 0.2s',
        zIndex: 10,
    };

    return (
        <GanttTable></GanttTable>
        // <div style={mainContainerStyle} className="bg-gray-100">
        //     <h1 className="text-3xl font-bold text-gray-800 mb-6">
        //         Ejemplo de Split Resizer (Redimensionamiento)
        //     </h1>

        //     <div style={splitContainerStyle} ref={containerRef} className="bg-white">

        //         {/* --- PANEL IZQUIERDO --- */}
        //         <div
        //             className="p-4 overflow-auto"
        //             style={{ width: `${leftPanelWidth}%`, backgroundColor: '#eef2ff' }} // indigo-50
        //         >
        //             <h2 className="text-xl font-semibold text-indigo-700 mb-2">Panel Izquierdo ({leftPanelWidth.toFixed(1)}%)</h2>
        //             <p className="text-gray-600">Este panel es redimensionable. Su ancho se controla mediante el estado de React (`leftPanelWidth`).</p>
        //             <div className="mt-4 p-3 bg-indigo-200 rounded-lg text-sm">
        //                 <p>Arrastra la barra gris central para cambiar el tamaño.</p>
        //             </div>
        //         </div>

        //         {/* --- DIVISOR ARRASTRABLE --- */}
        //         <div
        //             style={splitterStyle}
        //             onMouseDown={startResize}
        //             onTouchStart={startResize}
        //             title="Arrastrar para redimensionar"
        //         />

        //         {/* --- PANEL DERECHO (Ocupa el resto del espacio) --- */}
        //         <div
        //             className="p-4 overflow-auto flex-grow"
        //             style={{
        //                 width: `${100 - leftPanelWidth}%`,
        //                 backgroundColor: '#f0fdf4' // emerald-50
        //             }}
        //         >
        //             <h2 className="text-xl font-semibold text-green-700 mb-2">Panel Derecho ({(100 - leftPanelWidth).toFixed(1)}%)</h2>
        //             <p className="text-gray-600">Este panel automáticamente ocupa el espacio restante (100% menos el ancho del panel izquierdo).</p>
        //             <p className="mt-2 text-gray-600">La lógica de redimensionamiento se gestiona a nivel de la ventana (`window.addEventListener`) mientras se arrastra.</p>
        //         </div>
        //     </div>




        // </div>
    );
}

export default App;
