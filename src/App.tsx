import React, { FC, useState, useMemo, useCallback, useRef } from 'react';
import TableGantt from './TableGantt';

// ------------------------------
// 1. TIPOS DE DATOS (TypeScript)
// ------------------------------

interface Person {
    id: number;
    firstName: string;
    lastName: string;
    age: number;
    visits: number;
}

// Define las propiedades iniciales de las columnas
interface ColumnConfig {
    id: keyof Person;
    header: string;
    initialSize: number;
}

// ------------------------------
// 2. DATOS DE EJEMPLO Y CONFIGURACIÓN
// ------------------------------

const defaultData: Person[] = [
    { id: 1, firstName: 'Juan', lastName: 'Pérez', age: 24, visits: 10 },
    { id: 2, firstName: 'María', lastName: 'López', age: 30, visits: 5 },
    { id: 3, firstName: 'Pedro', lastName: 'García', age: 45, visits: 22 },
    { id: 4, firstName: 'Ana', lastName: 'Martínez', age: 21, visits: 17 },
    { id: 5, firstName: 'Carlos', lastName: 'Sánchez', age: 38, visits: 8 },
];

const initialColumns: ColumnConfig[] = [
    { id: 'id', header: 'ID', initialSize: 60 },
    { id: 'firstName', header: 'Nombre', initialSize: 150 },
    { id: 'lastName', header: 'Apellido', initialSize: 150 },
    { id: 'age', header: 'Edad', initialSize: 80 },
    { id: 'visits', header: 'Visitas', initialSize: 100 },
];

// Inicializa el estado de anchos a partir de la configuración
const initialWidths: Record<keyof Person, number> = initialColumns.reduce((acc, col) => {
    acc[col.id] = col.initialSize;
    return acc;
}, {} as Record<keyof Person, number>);


// ------------------------------
// 3. COMPONENTE PRINCIPAL
// ------------------------------

const App: FC = () => {
    const [data] = useState(defaultData);
    // Estado para guardar los anchos de c-olumna (controlado manualmente)
    const [columnWidths, setColumnWidths] = useState<Record<keyof Person, number>>(initialWidths);
    
    // Refs para rastrear el redimensionamiento
    const resizingInfo = useRef<{
        isResizing: boolean;
        currentColumnId: keyof Person | null;
        startX: number;
        startWidth: number;
    }>({
        isResizing: false,
        currentColumnId: null,
        startX: 0,
        startWidth: 0,
    });
    
    // Calcula el ancho total de la tabla
    const totalTableWidth = useMemo(() => 
        Object.values(columnWidths).reduce((sum, width) => sum + width, 0), 
        [columnWidths]
    );

    // ----------------------------------------------------------------------
    // MANEJADORES DE REDIMENSIONAMIENTO (DRAG AND DROP)
    // ----------------------------------------------------------------------

    // Inicia el proceso de redimensionamiento al presionar el botón del ratón o tocar la pantalla
    const startResize = useCallback((columnId: keyof Person, e: React.MouseEvent | React.TouchEvent) => {
        // Previene la selección de texto
        e.preventDefault();
        
        // Obtiene la posición X inicial (compatible con mouse y touch)
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

        resizingInfo.current = {
            isResizing: true,
            currentColumnId: columnId,
            startX: clientX,
            startWidth: columnWidths[columnId],
        };

        // Adjunta los listeners al documento/ventana para manejar el movimiento fuera de la tabla
        window.addEventListener('mousemove', handleMouseMove as (e: MouseEvent) => void);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleMouseMove as (e: TouchEvent) => void);
        window.addEventListener('touchend', handleMouseUp);

    }, [columnWidths]);

    // Actualiza el ancho de la columna mientras se arrastra
    const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!resizingInfo.current.isResizing || !resizingInfo.current.currentColumnId) return;

        const { currentColumnId, startX, startWidth } = resizingInfo.current;
        // Obtiene la posición X actual (compatible con mouse y touch)
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        
        const diff = clientX - startX;
        const newWidth = Math.max(startWidth + diff, 40); // 40px es el ancho mínimo

        setColumnWidths(prev => ({
            ...prev,
            [currentColumnId]: newWidth,
        }));
    }, []);

    // Finaliza el proceso de redimensionamiento
    const handleMouseUp = useCallback(() => {
        resizingInfo.current.isResizing = false;
        resizingInfo.current.currentColumnId = null;

        // Limpia los listeners
        window.removeEventListener('mousemove', handleMouseMove as (e: MouseEvent) => void);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleMouseMove as (e: TouchEvent) => void);
        window.removeEventListener('touchend', handleMouseUp);
    }, [handleMouseMove]);

    // ----------------------------------------------------------------------
    // ESTILOS INLINE (REEMPLAZANDO TAILWIND)
    // ----------------------------------------------------------------------
    const styles = useMemo(() => ({
        // Estilos del contenedor principal (equivalente a p-4 min-h-screen bg-gray-100 flex justify-center)
        mainContainer: {
            padding: '16px',
            minHeight: '100vh',
            backgroundColor: '#f3f4f6', // gray-100
            fontFamily: 'sans-serif',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start', // Alinea arriba
        },
        // Estilos del contenedor de la tabla (equivalente a inline-block)
        inlineBlockContainer: {
            display: 'inline-block',
            marginTop: '32px', // Espacio superior para que no toque el borde
            width: '100%',
        },
        // Estilos del contenedor de sombra y bordes (equivalente a bg-white rounded-xl shadow-2xl overflow-hidden)
        tableWrapper: {
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', // shadow-2xl
            overflow: 'hidden',
        },
        // Estilos de la tabla
        table: {
            borderCollapse: 'collapse',
            width: `${totalTableWidth}px`,
            minWidth: '100%',
        },
        // Estilos de los encabezados (p-3 bg-indigo-600 text-white text-sm border-r font-semibold text-left)
        headerCell: {
            position: 'relative',
            padding: '12px',
            backgroundColor: '#4f46e5', // indigo-600
            color: 'white',
            fontSize: '14px',
            borderRight: '1px solid #4338ca', // indigo-700
            fontWeight: 600,
            textAlign: 'left' as const,
        },
        // Estilos del redimensionador (w-2 h-full cursor-col-resize)
        resizer: (isResizing: boolean) => ({
            position: 'absolute' as const,
            top: 0,
            right: 0,
            width: '8px', // w-2
            height: '100%',
            cursor: 'col-resize',
            userSelect: 'none' as const,
            transition: 'background-color 0.1s ease-out',
            backgroundColor: isResizing ? '#facc15' : 'transparent', // yellow-400 / transparent
        }),
        // Estilos de las celdas (p-3 text-sm text-gray-700 border-r border-gray-200)
        dataCell: {
            padding: '12px',
            fontSize: '14px',
            color: '#374151', // gray-700
            borderRight: '1px solid #e5e7eb', // gray-200
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
        },
        // Estilos de las filas (border-t border-gray-200)
        tableRow: {
            borderTop: '1px solid #e5e7eb', // gray-200
            // No podemos hacer el hover con CSS inline, se necesita JS o CSS externo.
        },
        // Estilos del texto informativo
        infoText: {
            marginTop: '32px',
            textAlign: 'center' as const,
            color: '#4b5563', // gray-600
            fontSize: '14px',
        },
        title: {
            fontSize: '30px',
            fontWeight: '800',
            color: '#4f46e5', // indigo-700
            marginBottom: '24px',
            textAlign: 'center' as const,
        }
    }), [totalTableWidth]);


    // ----------------------------------------------------------------------

    return (
        <TableGantt></TableGantt>

    );
};

export default App;