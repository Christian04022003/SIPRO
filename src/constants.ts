import { Task, ColumnDef, ViewModeType } from './types';

// --- CONFIGURACIÓN DE GANTT Y TAMAÑOS ---
export const BAR_HEIGHT = 34;
export const BAR_PADDING = 8;
export const ROW_HEIGHT_PX = BAR_HEIGHT + BAR_PADDING * 2; // Altura total de la fila

export const ViewMode: { [key in ViewModeType]: ViewModeType } = {
    Day: 'Day',
    Week: 'Week',
    Month: 'Month',
    Year: 'Year'
};

// NOTA: 'start' y 'end' se llenarán automáticamente o se corregirán por el CPM en la App.
// Usamos 'duration' aquí para representar la complejidad de las rutas.
// FECHA DE INICIO DEL PROYECTO: 2025-01-01 (Miércoles)

/** @type {Task[]} */
export const initialTasks = [
    // RUTA PRINCIPAL (CRÍTICA)
    { id: 'P1', name: '01. Planificación Inicial', start: '2025-01-01', end: '2025-01-05', duration: 5, progress: 0, parentId: null, cost: 500, priority: 'Media', dependencies: '', isMilestone: false },
    { id: 'A1', name: '02. Diseño de Producto (Ruta Larga)', start: '2025-01-06', end: '2025-01-15', duration: 10, progress: 0, parentId: null, cost: 3000, priority: 'Alta', dependencies: 'P1', isMilestone: false },
    { id: 'A2', name: '03. Desarrollo y Pruebas (Ruta Larga)', start: '2025-01-16', end: '2025-01-30', duration: 15, progress: 0, parentId: null, cost: 10000, priority: 'Alta', dependencies: 'A1', isMilestone: false },

    // RUTA PARALELA 1 (Corta - Holgura 13 días)
    { id: 'B1', name: '04. Creación de Contenido Web', start: '2025-01-06', end: '2025-01-08', duration: 3, progress: 100, parentId: null, cost: 1500, priority: 'Media', dependencies: 'P1', isMilestone: false },
    { id: 'B2', name: '05. Campaña de Marketing y Redes', start: '2025-01-09', end: '2025-01-13', duration: 5, progress: 0, parentId: null, cost: 4000, priority: 'Alta', dependencies: 'B1', isMilestone: false },
    
    // RUTA PARALELA 2 (Corta - Holgura 17 días)
    { id: 'C1', name: '06. Revisión de Políticas', start: '2025-01-09', end: '2025-01-12', duration: 4, progress: 100, parentId: null, cost: 1000, priority: 'Baja', dependencies: 'B1', isMilestone: false },
    { id: 'C2', name: '07. Hito: Aprobación Legal', start: '2025-01-13', end: '2025-01-13', duration: 1, progress: 100, parentId: null, cost: 0, priority: 'Baja', dependencies: 'C1', isMilestone: true },
    
    // TAREA DE CONVERGENCIA Y FINAL
    { id: 'D1', name: '08. Integración y Despliegue Final', start: '2025-01-31', end: '2025-02-01', duration: 2, progress: 0, parentId: null, cost: 2000, priority: 'Alta', dependencies: 'A2, B2, C2', isMilestone: false },
    { id: 'F', name: '09. Hito de Lanzamiento Oficial', start: '2025-02-02', end: '2025-02-02', duration: 1, progress: 0, parentId: null, cost: 0, priority: 'Alta', dependencies: 'D1', isMilestone: true },
];

export const defaultColumnsDef = [
    { id: 'index', header: 'Índice', defaultSize: 70, accessorKey: 'index' }, 
    { id: 'name', header: 'Tarea', defaultSize: 250, accessorKey: 'name' }, // Más grande para nombres largos
    { id: 'start', header: 'Inicio', defaultSize: 100, accessorKey: 'start' },
    { id: 'end', header: 'Fin', defaultSize: 100, accessorKey: 'end' },
    { id: 'progress', header: 'Progreso (%)', defaultSize: 100, accessorKey: 'progress' },
    { id: 'totalSlack', header: 'Holgura (d)', defaultSize: 100, accessorKey: 'totalSlack' },
    { id: 'cost', header: 'Costo ($)', defaultSize: 100, accessorKey: 'cost' },
    { id: 'priority', header: 'Prioridad', defaultSize: 100, accessorKey: 'priority' },
    { id: 'dependencies', header: 'Dependencias', defaultSize: 120, accessorKey: 'dependencies' },
];