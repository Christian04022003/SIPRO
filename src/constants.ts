// src/constants.ts
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

// --- TAREAS INICIALES ---
export const initialTasks = [
    { id: 'T1', name: 'Fase 1: Planificación', start: '2025-01-01', end: '2025-01-10', progress: 50, parentId: null, cost: 1000, priority: 'Alta', dependencies: '', isMilestone: false },
    // { id: 'T2', name: 'Recolección de Requisitos', start: '2025-01-01', end: '2025-01-05', progress: 100, parentId: 'T1', cost: 300, priority: 'Media', dependencies: '', isMilestone: false },
    // { id: 'T3', name: 'Diseño Conceptual', start: '2025-01-06', end: '2025-01-10', progress: 0, parentId: 'T1', cost: 700, priority: 'Alta', dependencies: 'T2', isMilestone: false },
    // { id: 'T4', name: 'Hito: Plan Aprobado', start: '2025-01-10', end: '2025-01-10', progress: 100, parentId: 'T1', cost: 0, priority: 'Alta', dependencies: 'T3', isMilestone: true },
    // { id: 'T5', name: 'Fase 2: Ejecución', start: '2025-01-11', end: '2025-01-25', progress: 0, parentId: null, cost: 5000, priority: 'Alta', dependencies: 'T4', isMilestone: false },
    // { id: 'T6', name: 'Desarrollo Backend', start: '2025-01-11', end: '2025-01-20', progress: 0, parentId: 'T5', cost: 2500, priority: 'Alta', dependencies: 'T4', isMilestone: false },
];

export const defaultColumnsDef = [
    { id: 'index', header: 'Índice', defaultSize: 70, accessorKey: 'index' }, // NUEVA COLUMNA DE ÍNDICE
    { id: 'name', header: 'Tarea', defaultSize: 200, accessorKey: 'name' },
    { id: 'start', header: 'Inicio', defaultSize: 100, accessorKey: 'start' },
    { id: 'end', header: 'Fin', defaultSize: 100, accessorKey: 'end' },
    { id: 'progress', header: 'Progreso (%)', defaultSize: 100, accessorKey: 'progress' },
    { id: 'totalSlack', header: 'Holgura (d)', defaultSize: 100, accessorKey: 'totalSlack' },
    { id: 'cost', header: 'Costo ($)', defaultSize: 80, accessorKey: 'cost' },
    { id: 'priority', header: 'Prioridad', defaultSize: 100, accessorKey: 'priority' },
    { id: 'dependencies', header: 'Dependencias', defaultSize: 120, accessorKey: 'dependencies' },
];