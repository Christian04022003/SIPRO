import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

// Definiciones de tipos y constantes asumidas
/** @typedef {'Day' | 'Week' | 'Month'} ViewModeType */
/** @typedef {'Alta' | 'Media' | 'Baja'} PriorityType */
/** @typedef {{ id: string, name: string, start: string, end: string, progress: number, parentId: string | null, cost: number, priority: PriorityType, dependencies: string, isMilestone: boolean, index?: string, [key: string]: any }} Task */
/** @typedef {Task & { duration: number, earlyStart: string, earlyFinish: string, lateStart: string, lateFinish: string, totalSlack: number, isCritical: boolean }} TaskWithCPM */
/** @typedef {{ id: string, header: string, defaultSize: number, accessorKey: string }} ColumnDef */

// [NOTA: Los imports de initialTasks, defaultColumnsDef, ViewMode, EditableCell, CustomGantt deben ser correctos en tu proyecto]
import { initialTasks, ViewMode } from './constants'; 
import EditableCell from './components/EditableCell';
import CustomGantt from './components/CustomGantt';


const ROW_HEIGHT_PX = 30;
const BAR_HEIGHT = 25;
const BAR_PADDING = (ROW_HEIGHT_PX - BAR_HEIGHT) / 2;

// --- DEFINICIÓN DE COLUMNAS (Asegurarse de que incluya las nuevas) ---
// Normalmente esto viene de constants.js, pero lo defino aquí para la demostración
const defaultColumnsDef = [
    { id: 'index', header: 'N°', defaultSize: 60, accessorKey: 'index' }, // NUEVA: Número de tarea jerárquico
    { id: 'name', header: 'Tarea', defaultSize: 250, accessorKey: 'name' },
    { id: 'start', header: 'Inicio', defaultSize: 100, accessorKey: 'start' },
    { id: 'end', header: 'Fin', defaultSize: 100, accessorKey: 'end' },
    { id: 'progress', header: 'Progreso', defaultSize: 80, accessorKey: 'progress' },
    { id: 'totalSlack', header: 'Holgura', defaultSize: 80, accessorKey: 'totalSlack' }, // NUEVA: Holgura total
    { id: 'cost', header: 'Costo', defaultSize: 100, accessorKey: 'cost' },
    { id: 'priority', header: 'Prioridad', defaultSize: 100, accessorKey: 'priority' },
    { id: 'dependencies', header: 'Precede', defaultSize: 80, accessorKey: 'dependencies' },
];

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
    const parentIndex = tasks.findIndex(t => t.id === parentId);
    if (parentIndex === -1) return -1;
    let lastIndex = parentIndex;

    for (let i = parentIndex + 1; i < tasks.length; i++) {
        let currentParentId = tasks[i].parentId;
        let isDescendant = false;

        while (currentParentId) {
            if (currentParentId === parentId) {
                isDescendant = true;
                break; 
            }
            const parentTask = tasks.find(t => t.id === currentParentId);
            currentParentId = parentTask ? parentTask.parentId : null; 
        }

        if (isDescendant) {
            lastIndex = i;
        } else {
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


const rollupParentDates = (parentId, tasks) => {
    const children = tasks.filter(t => t.parentId === parentId);
    
    if (children.length === 0) {
        const parent = tasks.find(t => t.id === parentId);
        return { start: parent?.start, end: parent?.end };
    }

    const startTimestamps = children
        .map(t => new Date(t.start).getTime())
        .filter(t => !isNaN(t));
        
    const endTimestamps = children
        .map(t => new Date(t.end).getTime())
        .filter(t => !isNaN(t));

    if (startTimestamps.length === 0 || endTimestamps.length === 0) {
        const parent = tasks.find(t => t.id === parentId);
        return { start: parent?.start, end: parent?.end };
    }

    const earliestStart = new Date(Math.min(...startTimestamps));
    const latestEnd = new Date(Math.max(...endTimestamps));

    return {
        start: earliestStart.toISOString().split('T')[0],
        end: latestEnd.toISOString().split('T')[0],
    };
};

// =================================================================
// --- UTILITIES (Para CPM - Critical Path Method) ---
// =================================================================

const getPredecessors = (taskId, tasks) => {
    return tasks.filter(t => t.dependencies && t.dependencies.split(',').map(id => id.trim()).includes(taskId));
};

const dateToDays = (dateStr) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 0;
    const baseDate = new Date('2000-01-01');
    return Math.floor((date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
};

const daysToDate = (days) => {
    const baseDate = new Date('2000-01-01');
    const newDate = new Date(baseDate.getTime() + (days * 1000 * 60 * 60 * 24));
    return newDate.toISOString().split('T')[0];
};

/**
 * Función principal de cálculo de la Ruta Crítica (CPM)
 * @param {Task[]} tasks 
 * @returns {TaskWithCPM[]} Tareas con ES, EF, LS, LF, totalSlack, e isCritical
 */
/**
 * Calcula el Método de la Ruta Crítica (CPM) con logs detallados.
 */
 const calculateCriticalPath = (tasks) => {
    if (!tasks || tasks.length === 0) return [];

    console.log("--- 🕵️ INICIO DE CÁLCULO CPM ---");
    
    // FASE 0: PREPARACIÓN DE DATOS (Mantenida)
    let cpmTasks = tasks.map(t => ({ 
        ...t, 
        duration: getDuration(t.start, t.end),
        earlyStart: t.start, 
        earlyFinish: t.end,   
        lateStart: '', lateFinish: '', 
        totalSlack: 0, isCritical: false 
    }));

    console.log("Cpm tasks")
    console.log(cpmTasks)
    const taskMap = new Map(cpmTasks.map(t => [t.id, t]));
    console.log("tasks map")
    console.log(taskMap)

    
    // ----------------------------------------------------
    // FASE 1: PASO ADELANTE (FORWARD PASS)
    // ----------------------------------------------------
    console.log("\n--- ➡️ FASE 1: PASO ADELANTE (Calculando Early Dates) ---");
    for (const task of cpmTasks) {
        let maxPredecessorFinishDay = -Infinity; 
        console.log(-Infinity)
        const dependencies = task.dependencies ? task.dependencies.split(',').map(id => id.trim()) : [];
        
        console.log(`\n[${task.id}] PROCESANDO: ${task.name} (Duración: ${task.duration} días)`);
        
        if (dependencies.length > 0) {
            console.log(`  🔎 Buscando EF máximo de Predecesores: ${dependencies.join(', ')}`);
            for (const depId of dependencies) {
                const predecessor = taskMap.get(depId);
                if (predecessor && predecessor.earlyFinish) {
                    const predecessorEFDay = dateToDays(predecessor.earlyFinish);
                    
                    // Mostramos la comparación
                    console.log(`    - Predecesor ${depId}: EF (Día ${predecessorEFDay}). Máximo actual: ${maxPredecessorFinishDay}`);
                    
                    maxPredecessorFinishDay = Math.max(
                        maxPredecessorFinishDay, 
                        predecessorEFDay
                    );
                }
            }
        } else {
            console.log("  🛑 No tiene dependencias. ES usa la fecha programada.");
        }
        
        // Cálculo de ES y EF
        const earlyStartDay = isFinite(maxPredecessorFinishDay) 
            ? maxPredecessorFinishDay + 1 
            : dateToDays(task.start); 

        const earlyFinishDay = earlyStartDay + task.duration - 1; 

        task.earlyStart = daysToDate(earlyStartDay);
        task.earlyFinish = daysToDate(earlyFinishDay);

        console.log(`  Resultado: Max EF de predecesores (Día ${maxPredecessorFinishDay}).`);
        console.log(`  -> ES: Día ${earlyStartDay} (${task.earlyStart})`);
        console.log(`  -> EF: Día ${earlyFinishDay} (${task.earlyFinish})`);
    }

    // ----------------------------------------------------
    // FASE 2: PASO ATRÁS (BACKWARD PASS)
    // ----------------------------------------------------
    
    // 1. Determinar el Fin del Proyecto
    const projectFinishDay = cpmTasks.reduce((max, t) => {
        const finishDay = dateToDays(t.earlyFinish);
        return finishDay > max ? finishDay : max;
    }, -Infinity);

    console.log(`\n--- ⬅️ FASE 2: PASO ATRÁS (Calculando Late Dates) ---`);
    console.log(`[PROYECTO FINALIZACIÓN]: El EF máximo es el Día ${projectFinishDay}.`);

    // 2. Iterar en orden inverso (CRUCIAL)
    for (let i = cpmTasks.length - 1; i >= 0; i--) {
        const task = cpmTasks[i];
        const successors = getPredecessors(task.id, cpmTasks); 
        let minSuccessorStartDay = Infinity; 
        
        console.log(`\n[${task.id}] PROCESANDO: ${task.name}`);

        if (successors.length > 0) {
            console.log(`  🔎 Buscando LS mínimo de Sucesores: ${successors.map(s => s.id).join(', ')}`);
            for (const successor of successors) {
                const successorLS = taskMap.get(successor.id);
                const successorLSDay = dateToDays(successorLS.lateStart);

                // Mostramos la comparación
                console.log(`    - Sucesor ${successor.id}: LS (Día ${successorLSDay}). Mínimo actual: ${minSuccessorStartDay}`);
                
                minSuccessorStartDay = Math.min(
                    minSuccessorStartDay, 
                    successorLSDay
                );
            }
        } else {
            console.log(`  🛑 Tarea final (o sin sucesores). LF se iguala al Fin del Proyecto (Día ${projectFinishDay}).`);
        }

        // Cálculo de LF, LS, y Holgura
        const lateFinishDay = isFinite(minSuccessorStartDay) 
            ? minSuccessorStartDay - 1 
            : projectFinishDay;        

        const lateStartDay = lateFinishDay - task.duration + 1;

        task.lateFinish = daysToDate(lateFinishDay);
        task.lateStart = daysToDate(lateStartDay);

        // IDENTIFICACIÓN DE CRITICIDAD
        task.totalSlack = lateStartDay - dateToDays(task.earlyStart);
        task.isCritical = task.totalSlack <= 0;

        console.log(`  Resultado: Min LS de sucesores (Día ${minSuccessorStartDay}).`);
        console.log(`  -> LF: Día ${lateFinishDay} (${task.lateFinish})`);
        console.log(`  -> LS: Día ${lateStartDay} (${task.lateStart})`);
        console.log(`  -> HOLGURA (LS - ES): ${task.totalSlack} días. CRÍTICA: ${task.isCritical ? '✅' : '❌'}`);
    }

    console.log("\n--- ✅ CÁLCULO CPM COMPLETADO (Resultado final en cpmTasks) ---");

    return cpmTasks;
};


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

    // 🌟 LÓGICA DE PROCESAMIENTO DE TAREAS CON CPM 🌟
    // 1. Añadir índices de jerarquía (1, 1.1, 1.1.1)
    const tasksWithIndices = useMemo(() => calculateTaskIndices(tasks), [tasks]);
    
    // 2. Calcular la Ruta Crítica (CPM)
    /** @type {TaskWithCPM[]} */
    const fullTaskData = useMemo(() => calculateCriticalPath(tasksWithIndices), [tasksWithIndices]);


    // --- UTILITIES Y HANDLERS (Uso de useCallback) ---

    const rollupDates = useCallback((parentId, currentTasks) => {
        return rollupParentDates(parentId, currentTasks); 
    }, []); 


    const calculateAggregatedProgress = useCallback((parentId, currentTasks) => {
        const children = currentTasks.filter(t => t.parentId === parentId);
        if (children.length === 0) return currentTasks.find(t => t.id === parentId)?.progress ?? 0;
        let totalWeightedProgress = 0;
        let totalDuration = 0;
        for (const child of children) {
            const duration = getDuration(child.start, child.end);
            const childProgress = currentTasks.some(t => t.parentId === child.id) ? calculateAggregatedProgress(child.id, currentTasks) : child.progress;
            
            totalWeightedProgress += (childProgress * duration);
            totalDuration += duration;
        }
        return totalDuration === 0 ? 0 : Math.round(totalWeightedProgress / totalDuration);
    }, []);


    const createNewTask = useCallback((currentTasks, parentId, isMilestone) => {
        const id = generateUniqueId(currentTasks);
        
        const parentTask = parentId ? currentTasks.find(t => t.id === parentId) : null;
        
        const today = new Date().toISOString().split('T')[0];
        const startDate = parentTask ? parentTask.start : today;
        
        const endDate = isMilestone 
            ? startDate 
            : addDays(startDate, 4); 

        return {
            id: id, 
            name: isMilestone ? `Hito ${id}` : `Tarea ${id}`, 
            start: startDate, 
            end: endDate,     
            progress: isMilestone ? 100 : 0, 
            parentId: parentId, 
            cost: 100, 
            priority: isMilestone ? 'Alta' : 'Media',
            dependencies: parentId || '', 
            isMilestone: isMilestone,
        };
    }, []); 


    const addNewTask = useCallback((parentId = null) => {
        setTasks(prevTasks => {
            const newTask = createNewTask(prevTasks, parentId, false);
            let newTasks = [...prevTasks];
            
            if (parentId) {
                const lastDescendantIndex = findLastDescendantIndex(parentId, newTasks);
                if (lastDescendantIndex !== -1) {
                    newTasks.splice(lastDescendantIndex + 1, 0, newTask);
                } else { 
                    newTasks.push(newTask);
                }
                
                // Recalcular datos del padre
                newTasks = newTasks.map(t => 
                    t.id === parentId 
                        ? { ...t, ...rollupDates(parentId, newTasks) }
                        : t
                );
            } else { 
                newTasks.push(newTask); 
            }
            
            return newTasks; 
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
                    
                    if (columnId === 'cost' || columnId === 'progress') finalValue = parseFloat(newValue) || 0;
                    if (columnId === 'progress') finalValue = Math.min(100, Math.max(0, finalValue));
                    
                    return { ...task, [columnId]: finalValue };
                }
                return task;
            });

            const modifiedTask = updatedTasks.find(t => t.id === id);

            // 2. LÓGICA DE ROLL-UP: Progreso (Progress)
            if (modifiedTask && modifiedTask.parentId && columnId === 'progress') {
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
                let parentIdToUpdate = modifiedTask.parentId;
            
                while (parentIdToUpdate) {
                    const { start, end } = rollupDates(parentIdToUpdate, updatedTasks); 
                    
                    updatedTasks = updatedTasks.map(t => 
                        t.id === parentIdToUpdate 
                            ? { ...t, start, end } 
                            : t
                    );
                    
                    const parentTask = updatedTasks.find(t => t.id === parentIdToUpdate);
                    parentIdToUpdate = parentTask ? parentTask.parentId : null;
                }
            }

            return updatedTasks;
        });
    }, [rollupDates, calculateAggregatedProgress]);

    // --- El resto de funciones (Mantenidas) ---

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


    // --- Estilos y Renderizado (Mantenidos) ---

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