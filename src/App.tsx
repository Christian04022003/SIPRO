import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

// Definiciones de tipos y constantes asumidas
/** @typedef {'Day' | 'Week' | 'Month'} ViewModeType */
/** @typedef {'Alta' | 'Media' | 'Baja'} PriorityType */
/** @typedef {{ id: string, name: string, start: string, end: string, progress: number, parentId: string | null, cost: number, priority: PriorityType, dependencies: string, isMilestone: boolean, index?: string, [key: string]: any }} Task */
/** @typedef {Task & { duration: number, earlyStart: string, earlyFinish: string, lateStart: string, lateFinish: string, totalSlack: number, isCritical: boolean }} TaskWithCPM */
/** @typedef {{ id: string, header: string, defaultSize: number, accessorKey: string }} ColumnDef */

// [NOTA: Los imports de initialTasks, defaultColumnsDef, ViewMode, EditableCell, CustomGantt deben ser correctos en tu proyecto]
import { initialTasks, defaultColumnsDef, ViewMode } from './constants';
import EditableCell from './components/EditableCell';
import CustomGantt from './components/CustomGantt';


const ROW_HEIGHT_PX = 30;
const BAR_HEIGHT = 25;
const BAR_PADDING = (ROW_HEIGHT_PX - BAR_HEIGHT) / 2;

// =================================================================
// --- UTILITIES (Funciones de Ayuda) ---
// =================================================================

const generateUniqueId = (tasks) => {
    let id;
    let num = tasks.length + 1;
    do {
        id = `T${num}`;
        num++;
    } while (tasks.some(t => t.id === id));
    return id;
};

const addDays = (dateStr, days) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

const getDuration = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
    // Se suma 1 para incluir el día de fin
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

const findLastDescendantIndex = (parentId, tasks) => {
    // 1. LOCALIZAR AL PADRE
    const parentIndex = tasks.findIndex(t => t.id === parentId);
    
    if (parentIndex === -1) {
        console.log(`[Paso 1] ¡ALERTA! Padre ${parentId} no encontrado. Deteniendo.`);
        return -1;
    }

    // Inicializar el índice del "último descendiente visto".
    let lastIndex = parentIndex;

    // 2. RECORRER TAREAS SIGUIENTES
    // Comenzamos a revisar las tareas a partir del índice justo después del padre.
    for (let i = parentIndex + 1; i < tasks.length; i++) {
        
        const currentTaskName = tasks[i].name;
        
        let currentParentId = tasks[i].parentId;
        let isDescendant = false;

        // Bucle que simula subir por el árbol genealógico de la tarea actual.
        while (currentParentId) {
            
            // A. ¿ES EL PADRE BUSCADO?
            if (currentParentId === parentId) {
                isDescendant = true;
                console.log(`  [Ascenso] ¡MATCH! "${currentTaskName}" es descendiente directo o indirecto.`);
                break; 
            }
            
            // B. SUBIR UN NIVEL MÁS
            const parentTask = tasks.find(t => t.id === currentParentId);
            currentParentId = parentTask ? parentTask.parentId : null; 
        }

        // --- FIN DEL CHEQUEO DE ASCENDENCIA ---

        // 3. DECISIÓN
        if (isDescendant) {
            // Si es descendiente, actualizamos el índice.
            lastIndex = i;
        } else {
            // Si NO es descendiente, hemos salido de la rama. ¡Detener y salir!
            break; 
        }
    }

    return lastIndex;
};

const calculateTaskIndices = (tasks) => {
    const indexTracker = {}; 
    const indexedTasks = [];

    for (const task of tasks) {
        const parentIdKey = task.parentId || 'root';

        let parentIndexPrefix = '';
        if (task.parentId) {
            const parent = indexedTasks.find(t => t.id === task.parentId);
            if (parent && parent.index) {
                parentIndexPrefix = parent.index + '.';
            }
        }

        indexTracker[parentIdKey] = (indexTracker[parentIdKey] || 0) + 1;
        const taskIndex = parentIndexPrefix + indexTracker[parentIdKey];
        indexedTasks.push({ ...task, index: taskIndex });
    }
    return indexedTasks;
};


const isTaskHidden = (task, collapsedParents, allTasks) => {
    if (!task.parentId) return false;

    let currentParentId = task.parentId;
    while (currentParentId) {
        if (collapsedParents[currentParentId]) return true;

        const parentTask = allTasks.find(t => t.id === currentParentId);
        currentParentId = parentTask ? parentTask.parentId : null;
    }
    return false;
};


// 🌟🌟🌟 IMPLEMENTACIÓN CLAVE: Lógica de Roll-up de Fechas 🌟🌟🌟
/**
 * @param {string} parentId 
 * @param {Task[]} tasks 
 * @returns {{ start: string, end: string }} Las fechas agregadas (inicio más temprano, fin más tardío).
 */
const rollupParentDates = (parentId, tasks) => {
    const children = tasks.filter(t => t.parentId === parentId);
    
    // Si no hay hijos (o no son válidos), no hacemos nada
    if (children.length === 0) {
        const parent = tasks.find(t => t.id === parentId);
        return { start: parent?.start, end: parent?.end };
    }

    // Convertir fechas a milisegundos para encontrar la fecha más temprana y más tardía
    const startTimestamps = children
        .map(t => new Date(t.start).getTime())
        .filter(t => !isNaN(t));
        
    const endTimestamps = children
        .map(t => new Date(t.end).getTime())
        .filter(t => !isNaN(t));

    // Si no hay fechas válidas, devolvemos las del padre
    if (startTimestamps.length === 0 || endTimestamps.length === 0) {
        const parent = tasks.find(t => t.id === parentId);
        return { start: parent?.start, end: parent?.end };
    }

    // Inicio agregado = Mínimo (más temprano) de los inicios de los hijos
    const earliestStart = new Date(Math.min(...startTimestamps));
    
    // Fin agregado = Máximo (más tardío) de los fines de los hijos
    const latestEnd = new Date(Math.max(...endTimestamps));

    // Formatear de vuelta a string 'YYYY-MM-DD'
    return {
        start: earliestStart.toISOString().split('T')[0],
        end: latestEnd.toISOString().split('T')[0],
    };
};
// ----------------------------------------------------------------

// =================================================================
// --- COMPONENTE PRINCIPAL (ProjectGanttApp) ---
// =================================================================
const ProjectGanttApp = () => {
    // --- ESTADO Y REFS (Mantenidos) ---
    const [leftPanelWidth, setLeftPanelWidth] = useState(55); 
    /** @type {Task[]} */
    const [tasks, setTasks] = useState(initialTasks);
    /** @type {ViewModeType} */
    const [viewMode, setViewMode] = useState(ViewMode.Month);
    const [collapsedParents, setCollapsedParents] = useState({});
    const [dynamicColumns, setDynamicColumns] = useState([]);
    const [columnWidths, setColumnWidths] = useState(
        defaultColumnsDef.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultSize }), {})
    );

    const [resizingColumnId, setResizingColumnId] = useState(null);
    const initialResizeX = useRef(0);
    const initialColumnWidth = useRef(0);

    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef(null);

    const tableScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);

    // --- LÓGICA DE PROCESAMIENTO DE TAREAS ---
    const fullTaskData = useMemo(() => calculateTaskIndices(tasks), [tasks]);
    const criticalTasks = []; 

    // --- UTILITIES Y HANDLERS (Uso de useCallback) ---

    // 🌟🌟🌟 Función de Roll-up de Fechas (usa la implementación real) 🌟🌟🌟
    const rollupDates = useCallback((parentId, currentTasks) => {
        // Llama a la función de utilidad implementada
        return rollupParentDates(parentId, currentTasks); 
    }, []); 
    // -----------------------------------------------------------------------


    const calculateAggregatedProgress = useCallback((parentId, currentTasks) => {
        const children = currentTasks.filter(t => t.parentId === parentId);
        if (children.length === 0) return currentTasks.find(t => t.id === parentId)?.progress ?? 0;
        let totalWeightedProgress = 0;
        let totalDuration = 0;
        for (const child of children) {
            const duration = getDuration(child.start, child.end);
            // Si la tarea hija es un padre, llama recursivamente (aunque esto podría ser optimizado)
            const childProgress = currentTasks.some(t => t.parentId === child.id) ? calculateAggregatedProgress(child.id, currentTasks) : child.progress;
            
            totalWeightedProgress += (childProgress * duration);
            totalDuration += duration;
        }
        return totalDuration === 0 ? 0 : Math.round(totalWeightedProgress / totalDuration);
    }, []);

// ... dentro de ProjectGanttApp ...

const createNewTask = useCallback((currentTasks, parentId, isMilestone) => {
    const id = generateUniqueId(currentTasks);
    console.log(currentTasks)
    
    // 1. Determinar la Fecha Base:
    // Si se proporciona un parentId, buscamos la tarea padre.
    console.log(`Se agrego desde ${parentId}`)
    const parentTask = parentId ? currentTasks.find(t => t.id === parentId) : null;
    console.log("Se encontro")
    console.log(parentTask)
    
    // Si hay un padre, usamos su fecha de inicio y fin.
    // Si NO hay padre (es tarea principal), o si el padre no existe, usamos la fecha de hoy.
    const today = new Date().toISOString().split('T')[0];
    const startDate = parentTask ? parentTask.start : today;
    
    // La fecha de fin es la fecha de inicio (para hitos) o 4 días después (para tareas)
    const endDate = isMilestone 
        ? startDate // Si es hito, fin = inicio
        : addDays(startDate, 4); // Si es tarea, fin = inicio + 4 días

    return {
        id: id, 
        name: isMilestone ? `Hito ${id}` : `Tarea ${id}`, 
        start: startDate, // <--- USA LA FECHA DEL PADRE
        end: endDate,     // <--- USA LA FECHA CALCULADA A PARTIR DEL PADRE
        progress: isMilestone ? 100 : 0, 
        parentId: parentId, 
        cost: 100, 
        priority: isMilestone ? 'Alta' : 'Media',
        dependencies: parentId || '', 
        isMilestone: isMilestone,
    };
}, [addDays]); // Asegúrate de que addDays se incluya en las dependencias si es un prop/función externa


const addNewTask = useCallback((parentId = null) => {
    
    // Log 1: Información inicial de la llamada a la función
    console.log("=======================================");
    console.log(">>> [addNewTask] INICIO del proceso <<<");
    console.log("Parámetro recibido (parentId):", parentId);

    setTasks(prevTasks => {
        // Log 2: Acceso al estado anterior
        console.log("[setTasks] Accediendo al estado anterior (prevTasks). Cantidad de tareas previas:", prevTasks.length);
        
        // --- 1. CREACIÓN DE LA TAREA ---
        const newTask = createNewTask(prevTasks, parentId, false);
        // Log 3: Tarea nueva generada
        console.log("[setTasks] Tarea generada por createNewTask:", newTask);

        // --- 2. PREPARACIÓN DEL NUEVO ESTADO ---
        let newTasks = [...prevTasks];
        // Log 4: Copia de tareas
        console.log("[setTasks] Se crea una copia inmutable (newTasks) para modificar.");
        
        // --- 3. LÓGICA DE INSERCIÓN CONDICIONAL ---
        if (parentId) {
            // Log 5: El código entra en la rama para subtareas
            console.log("[setTasks/if] La nueva tarea es un HIJO. Buscando el lugar de inserción...");
            
            const lastDescendantIndex = findLastDescendantIndex(parentId, newTasks);
            // Log 6: Resultado de la búsqueda de posición
            console.log(`[setTasks/if] Índice del ÚLTIMO descendiente del padre (${parentId}): ${lastDescendantIndex}`);

            if (lastDescendantIndex !== -1) {
                // Inserción ordenada
                newTasks.splice(lastDescendantIndex + 1, 0, newTask);
                // Log 7a: Inserción por splice
                console.log("[setTasks/if] Tarea insertada con SPLICE en el índice:", lastDescendantIndex + 1);
            } else { 
                // Inserción simple si no hay descendientes (o si es el único)
                newTasks.push(newTask);
                // Log 7b: Inserción por push
                console.log("[setTasks/if] El padre NO tiene otros descendientes. Tarea insertada con PUSH al final.");
            }
            
            // --- 4. RECALCULAR DATOS DEL PADRE ---
            // Recalcular fechas del padre después de agregar la tarea
            console.log(`[setTasks/if] Procesando RECALCULO de fechas para el padre ID: ${parentId}`);

            newTasks = newTasks.map(t => 
                t.id === parentId 
                    ? { ...t, ...rollupDates(parentId, newTasks) } // ¡El cambio ocurre aquí!
                    : t
            );
            // Log 8: Resultado del map
            console.log(`[setTasks/if] El padre (${parentId}) ha sido actualizado con los nuevos datos de rollupDates.`);
            
        } else { 
            // El código entra en la rama para tareas principales
            newTasks.push(newTask); 
            // Log 9: Inserción de tarea principal
            console.log("[setTasks/else] La nueva tarea es una tarea PRINCIPAL. Insertada con PUSH al final.");
        }
        
        // Log 10: Fin del proceso y valor devuelto
        console.log("[setTasks] Nuevo array de tareas generado. Longitud final:", newTasks.length);
        console.log("<<< [addNewTask] FIN del proceso >>>");
        console.log("=======================================");
        
        return newTasks; // Este es el valor que React usará para el nuevo estado
    });
}, [createNewTask, rollupDates]);

    const addNewMilestone = useCallback((parentId) => {
        setTasks(prevTasks => {
            const newMilestone = createNewTask(prevTasks, parentId, true);
            let newTasks = [...prevTasks];
            
            if (parentId) {
                const lastDescendantIndex = findLastDescendantIndex(parentId, newTasks);
                if (lastDescendantIndex !== -1) newTasks.splice(lastDescendantIndex + 1, 0, newMilestone);
                else newTasks.push(newMilestone);
                
                // Recalcular fechas del padre después de agregar el hito
                newTasks = newTasks.map(t => t.id === parentId ? { ...t, ...rollupDates(parentId, newTasks) } : t);
            } else { newTasks.push(newMilestone); }
            
            return newTasks;
        });
    }, [createNewTask, rollupDates]);
    

    const updateTaskData = useCallback((id, columnId, newValue) => {
        setTasks(prevTasks => {
            let updatedTasks = prevTasks.map(task => {
                if (task.id === id) {
                    let finalValue = newValue;
                    
                    // 1. Conversión y Validación Numérica
                    if (columnId === 'cost' || columnId === 'progress') finalValue = parseFloat(newValue) || 0;
                    if (columnId === 'progress') finalValue = Math.min(100, Math.max(0, finalValue));
                    
                    // console.log("columna", columnId); // Log de la columna
                    
                    return { ...task, [columnId]: finalValue };
                }
                return task;
            });

            const modifiedTask = updatedTasks.find(t => t.id === id);

            // 2. LÓGICA DE ROLL-UP: Progreso (Progress)
            if (modifiedTask && modifiedTask.parentId && columnId === 'progress') {
                // console.log("Tarea modificada - Progreso:", modifiedTask.name); 
                let parentIdToUpdate = modifiedTask.parentId;
                while (parentIdToUpdate) {
                    const progress = calculateAggregatedProgress(parentIdToUpdate, updatedTasks);
                    updatedTasks = updatedTasks.map(t => t.id === parentIdToUpdate ? { ...t, progress } : t);
                    const parentTask = updatedTasks.find(t => t.id === parentIdToUpdate);
                    parentIdToUpdate = parentTask ? parentTask.parentId : null;
                }
            }

            // 3. LÓGICA DE ROLL-UP: Fechas (Start/End)
            if (modifiedTask && modifiedTask.parentId && (columnId === 'start' || columnId === 'end')) {
                // console.log("Tarea modificada - Fecha:", modifiedTask.name, columnId); 
                
                let parentIdToUpdate = modifiedTask.parentId;
            
                while (parentIdToUpdate) {
                    // CÁLCULO: Obtiene el inicio más temprano y el fin más tardío
                    const { start, end } = rollupDates(parentIdToUpdate, updatedTasks); 
                    
                    // APLICACIÓN: Actualiza ambas fechas del padre
                    updatedTasks = updatedTasks.map(t => 
                        t.id === parentIdToUpdate 
                            ? { ...t, start, end } 
                            : t
                    );
                    
                    // ASCENSO: Sube al siguiente nivel (al abuelo)
                    const parentTask = updatedTasks.find(t => t.id === parentIdToUpdate);
                    parentIdToUpdate = parentTask ? parentTask.parentId : null;
                }
            }

            return updatedTasks;
        });
    }, [rollupDates, calculateAggregatedProgress]);

    // --- El resto de funciones (Mantenidas) ---

    // ... (omito funciones de redimensionamiento y UI, ya que no cambian la lógica principal) ...

    const addDynamicColumn = () => {
        const newColumnId = `Custom${dynamicColumns.length + 1}`;
        const newColumn = {
            id: newColumnId, header: `Campo ${dynamicColumns.length + 1}`, defaultSize: 150, accessorKey: newColumnId,
        };
        setDynamicColumns(prev => [...prev, newColumn]);

        setColumnWidths(prev => ({ ...prev, [newColumnId]: newColumn.defaultSize }));

        setTasks(prevTasks => prevTasks.map(task => ({ ...task, [newColumnId]: 'Nuevo Valor' })));
    };

    const startResizing = useCallback((columnId, e) => {
        e.preventDefault();
        e.stopPropagation();

        setResizingColumnId(columnId);
        initialResizeX.current = e.clientX;
        initialColumnWidth.current = columnWidths[columnId] || defaultColumnsDef.find(c => c.id === columnId)?.defaultSize || 100;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

    }, [columnWidths]);

    const onMouseMove = useCallback((e) => {
        if (!resizingColumnId) return;

        const deltaX = e.clientX - initialResizeX.current;
        const newWidth = Math.max(50, initialColumnWidth.current + deltaX);

        setColumnWidths(prev => ({
            ...prev,
            [resizingColumnId]: newWidth,
        }));
    }, [resizingColumnId]);

    const onMouseUp = useCallback(() => {
        if (!resizingColumnId) return;

        setResizingColumnId(null);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }, [resizingColumnId, onMouseMove]);

    const startResize = useCallback((e) => {
        setIsResizing(true);
        e.preventDefault();
    }, []);

    const stopResize = useCallback(() => {
        setIsResizing(false);
    }, []);

    const onResize = useCallback((e) => {
        if (!isResizing || !containerRef.current) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const containerBounds = containerRef.current.getBoundingClientRect();
        const newWidthPx = clientX - containerBounds.left;
        const newWidthPercent = (newWidthPx / containerBounds.width) * 100;

        if (newWidthPercent > 15 && newWidthPercent < 85) {
            setLeftPanelWidth(newWidthPercent);
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', onResize);
            window.addEventListener('mouseup', stopResize);
            window.addEventListener('touchmove', onResize);
            window.addEventListener('touchend', stopResize);
        }
        return () => {
            window.removeEventListener('mousemove', onResize);
            window.removeEventListener('mouseup', stopResize);
            window.removeEventListener('touchmove', onResize);
            window.removeEventListener('touchend', stopResize);
        };
    }, [isResizing, onResize, stopResize]);

    const columns = useMemo(() => [...defaultColumnsDef, ...dynamicColumns], [dynamicColumns]);

    const parentIds = useMemo(() => {
        const parents = fullTaskData
            .map(t => t.parentId)
            .filter(Boolean);
        return new Set(parents);
    }, [fullTaskData]);

    const visibleTasks = useMemo(() => {
        if (fullTaskData.length === 0) return [];
        return fullTaskData.filter((task) => !isTaskHidden(task, collapsedParents, fullTaskData));
    }, [fullTaskData, collapsedParents]);

    const toggleCollapse = useCallback((taskId) => {
        setCollapsedParents(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    }, []);

    const handleScroll = (scrollingElement, targetRef) => {
        if (targetRef.current && scrollingElement !== targetRef.current) {
            targetRef.current.scrollTop = scrollingElement.scrollTop;
        }
    };
    const onTableScroll = (e) => handleScroll(e.currentTarget, ganttScrollRef);
    const onGanttScroll = (e) => handleScroll(e.currentTarget, tableScrollRef);

    const totalTableWidth = useMemo(() => columns.reduce((sum, col) => sum + (columnWidths[col.id] || col.defaultSize), 0), [columns, columnWidths]);


    // --- Estilos y Renderizado (Mantenidos por brevedad) ---

    const mainAppStyle = { padding: '20px', fontFamily: 'Inter, Arial, sans-serif', backgroundColor: '#F9FAFB' };
    const headerStyle = { marginBottom: '20px', color: '#1F2937' };
    const controlsContainerStyle = { marginBottom: '15px', borderBottom: '1px solid #D1D5DB', paddingBottom: '10px', backgroundColor: "white", borderRadius: '8px', padding: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
    const controlItemStyle = { display: 'inline-block', marginRight: '15px', verticalAlign: 'middle' };
    const buttonStyle = { padding: '8px 15px', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', display: 'inline-block', transition: 'background-color 0.2s' };
    const secondaryButtonStyle = { ...buttonStyle, backgroundColor: '#10B981', padding: '8px 10px', marginRight: '15px' };
    const splitContainerStyle = {
        display: 'flex',
        height: '80vh',
        border: '1px solid #D1D5DB',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    };
    const tableContainerStyle = { overflow: 'auto', height: '100%', backgroundColor: 'white' };
    const tableHeaderRowStyle = { backgroundColor: '#F3F4F6', borderBottom: '2px solid #D1D5DB' };
    const tableRowStyle = { height: `${ROW_HEIGHT_PX}px`, borderBottom: '1px solid #E5E7EB', verticalAlign: 'top' };
    const viewModeControlsStyle = { marginLeft: 'auto', float: 'right', paddingTop: '3px' };

    const tableHeaderCellStyle = (columnId) => ({
        width: columnWidths[columnId] ? `${columnWidths[columnId]}px` : 'auto',
        minWidth: columnWidths[columnId] ? `${columnWidths[columnId]}px` : 'auto',
        position: 'sticky',
        top: 0,
        padding: '8px',
        textAlign: 'left',
        borderRight: '1px solid #E5E7EB',
        fontSize: '14px',
        color: '#374151',
        fontWeight: 'bold',
        zIndex: 1,
        backgroundColor: '#F3F4F6'
    });

    const tableCellWrapperStyle = (columnId) => ({
        padding: 0,
        borderRight: '1px solid #E5E7EB',
        verticalAlign: 'top',
        width: columnWidths[columnId] ? `${columnWidths[columnId]}px` : 'auto',
        minWidth: columnWidths[columnId] ? `${columnWidths[columnId]}px` : 'auto',
    });

    const resizeHandleStyle = {
        position: 'absolute',
        top: 0,
        right: 0,
        width: '5px',
        cursor: 'col-resize',
        height: '100%',
        backgroundColor: resizingColumnId ? '#4F46E5' : 'transparent',
        zIndex: 2,
    };


    return (
        <div style={mainAppStyle}>
            <h1 style={headerStyle}>Gestor de Proyectos</h1>

            <div style={controlsContainerStyle}>
                <div style={controlItemStyle}>
                    <button onClick={() => addNewTask(null)} style={buttonStyle}>+ Tarea Principal</button>
                </div>
                <div style={controlItemStyle}>
                    <button onClick={addDynamicColumn} style={secondaryButtonStyle}>+ Columna</button>
                </div>

                <div style={viewModeControlsStyle}>
                    {Object.keys(ViewMode).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            style={{
                                ...buttonStyle,
                                backgroundColor: viewMode === mode ? '#1E40AF' : '#6366F1',
                                padding: '6px 12px', fontSize: '12px', marginRight: '5px'
                            }}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            <div ref={containerRef} style={splitContainerStyle}>

                <div style={{ width: `${leftPanelWidth}%`, flexShrink: 0 }}>
                    <div ref={tableScrollRef} style={tableContainerStyle} onScroll={onTableScroll}>
                        <table style={{ minWidth: totalTableWidth, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                            <thead>
                                <tr style={tableHeaderRowStyle}>
                                    {columns.map(column => (
                                        <th key={column.id} style={tableHeaderCellStyle(column.id)}>
                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%' }}>
                                                {column.header}
                                                <div
                                                    style={resizeHandleStyle}
                                                    onMouseDown={(e) => startResizing(column.id, e)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleTasks.map((task) => (
                                    <tr key={task.id} style={tableRowStyle}>
                                        {columns.map(column => (
                                            <td
                                                key={`${task.id}-${column.id}`}
                                                style={tableCellWrapperStyle(column.accessorKey)}
                                            >
                                                <EditableCell
                                                    initialValue={task[column.accessorKey] ?? ''}
                                                    task={task}
                                                    columnId={column.accessorKey}
                                                    updateTaskData={updateTaskData}
                                                    allTasks={fullTaskData} 
                                                    parentIds={parentIds}
                                                    collapsedParents={collapsedParents}
                                                    toggleCollapse={toggleCollapse}
                                                    addNewTask={addNewTask}
                                                    addNewMilestone={addNewMilestone}
                                                />

                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div
                    onMouseDown={startResize}
                    onTouchStart={startResize}
                    style={{ width: '10px', cursor: 'col-resize', backgroundColor: '#D1D5DB', flexShrink: 0 }}
                />

                <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                    <CustomGantt
                        tasks={visibleTasks}
                        viewMode={viewMode}
                        scrollRef={ganttScrollRef}
                        onScroll={onGanttScroll}
                    />
                </div>
            </div>

            {(resizingColumnId || isResizing) && (
                <style>{`body { cursor: col-resize !important; user-select: none; }`}</style>
            )}
        </div>
    );
};

export default ProjectGanttApp;