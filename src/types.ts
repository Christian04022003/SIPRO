// src/types.ts

// Tipos de la API del proyecto
export type PriorityType = 'Baja' | 'Media' | 'Alta';
export type ViewModeType = 'Day' | 'Week' | 'Month' | 'Year';

// --- Interfaces de Datos ---

/**
 * Interfaz para las tareas tal como se almacenan en el estado (tasks)
 */
export interface Task {
    id: string;
    name: string;
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
    progress: number; // 0-100
    parentId: string | null;
    cost: number;
    priority: PriorityType;
    dependencies: string; // IDs separados por coma
    [key: string]: any;
}

/**
 * Interfaz para las tareas enriquecidas con datos del CPM (Critical Path Method)
 */
export interface TaskWithCPM extends Task {
    duration: number; // Calculada
    ES: string | null; // Earliest Start
    EF: string | null; // Earliest Finish
    LS: string | null; // Latest Start
    LF: string | null; // Latest Finish
    Float: number | null; // Holgura (Slack)
    successors: string[]; // Tareas sucesoras
    isCritical: boolean; // Si Holgura === 0
    index: number; // Índice en el array para posicionamiento en Gantt
}

/**
 * Interfaz para la definición de columnas de la tabla
 */
export interface ColumnDef {
    id: string;
    header: string;
    defaultSize: number;
    accessorKey: keyof Task | string;
}

// Archivo: src/types.ts

export interface Task {
    id: string;
    name: string;
    start: string;
    end: string;
    progress: number;
    parentId: string | null;
    cost: number;
    priority: string;
    dependencies: string;
    // Añadir este campo
    isMilestone?: boolean; 
    [key: string]: any; // Permite las columnas dinámicas
}
// ... otros tipos (TaskWithCPM, ViewModeType, ColumnDef, etc.)