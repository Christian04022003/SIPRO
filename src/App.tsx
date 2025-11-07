import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
// Después (Correcto):
import { initialTasks, defaultColumnsDef, ViewMode } from './constants';
import EditableCell from './components/EditableCell';
import CustomGantt from './components/CustomGantt';
// =================================================================
// --- TIPOS Y CONSTANTES ---
// =================================================================

/** @typedef {'Day' | 'Week' | 'Month'} ViewModeType */
/** @typedef {'Alta' | 'Media' | 'Baja'} PriorityType */
/** @typedef {{ id: string, name: string, start: string, end: string, progress: number, parentId: string | null, cost: number, priority: PriorityType, dependencies: string, isMilestone: boolean, index?: string, [key: string]: any }} Task */
/** @typedef {Task & { duration: number, earlyStart: string, earlyFinish: string, lateStart: string, lateFinish: string, totalSlack: number, isCritical: boolean }} TaskWithCPM */
/** @typedef {{ id: string, header: string, defaultSize: number, accessorKey: string }} ColumnDef */

const ROW_HEIGHT_PX = 30;
const BAR_HEIGHT = 25;
const BAR_PADDING = (ROW_HEIGHT_PX - BAR_HEIGHT) / 2;

// =================================================================
// --- UTILITIES Y MOCKS DE LÓGICA (CPM y Utils) ---
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

// LÓGICA DE UTILIDAD DE TAREAS (getTaskDepth)
const getTaskDepth = (task, allTasks) => {
    let depth = 0;
    let currentParentId = task.parentId;
    while (currentParentId) {
        depth++;
        const parentTask = allTasks.find(t => t.id === currentParentId);
        currentParentId = parentTask ? parentTask.parentId : null;
    }
    return depth;
};

// UTILITY: Calcula el índice jerárquico (1, 1.1, 1.2, 2, 2.1, etc.)
/**
 * @param {Task[]} tasks - Lista de tareas ordenada jerárquicamente.
 * @returns {Task[]} Lista de tareas con el campo 'index' añadido.
 */
const calculateTaskIndices = (tasks) => {
    const indexTracker = {}; // { parentId | 'root': lastIndexNumber }
    const indexedTasks = [];

    for (const task of tasks) {
        const parentIdKey = task.parentId || 'root';

        // 1. Determinar el prefijo del índice (ej: '1.' o '1.2.')
        let parentIndexPrefix = '';
        if (task.parentId) {
            // Se busca la tarea padre en la lista de tareas *ya indexadas*
            const parent = indexedTasks.find(t => t.id === task.parentId);
            if (parent && parent.index) {
                parentIndexPrefix = parent.index + '.';
            }
        }

        // 2. Incrementar el contador para este nivel específico
        indexTracker[parentIdKey] = (indexTracker[parentIdKey] || 0) + 1;

        // 3. Construir el índice jerárquico completo
        const taskIndex = parentIndexPrefix + indexTracker[parentIdKey];

        // 4. Almacenar la tarea con el nuevo índice
        indexedTasks.push({ ...task, index: taskIndex });
    }
    return indexedTasks;
};


// MOCK: Simulación de useCriticalPathData (Ruta Crítica)
const useCriticalPathData = (tasks) => {
    // Retorna las tareas con datos CPM de mock
    const fullTaskData = useMemo(() => tasks.map(t => ({
        ...t,
        duration: getDuration(t.start, t.end),
        earlyStart: t.start, earlyFinish: t.end, lateStart: t.start, lateFinish: t.end,
        totalSlack: t.isMilestone ? 0 : (t.id === 'T2' || t.id === 'T3' || t.id === 'T6' ? 0 : 2), // Mock de holgura
        isCritical: !t.isMilestone && (t.id === 'T2' || t.id === 'T3' || t.id === 'T6' || t.id === 'T5' || t.id === 'T4'), // Mock critical tasks
    })), [tasks]);
    const criticalTasks = fullTaskData.filter(t => t.isCritical && !t.isMilestone && !t.parentId).map(t => t.name);
    return { fullTaskData, criticalTasks };
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

const rollupParentDates = (parentId, tasks) => { return tasks; }; // Mock: No implementamos la lógica compleja de rollup de fechas.

// =================================================================
// --- COMPONENTE PRINCIPAL (ProjectGanttApp) ---
// =================================================================
const ProjectGanttApp = () => {
    // --- ESTADO Y REFS ---
    const [leftPanelWidth, setLeftPanelWidth] = useState(55); // Usado en porcentaje
    /** @type {Task[]} */
    const [tasks, setTasks] = useState(initialTasks);
    /** @type {ViewModeType} */
    const [viewMode, setViewMode] = useState(ViewMode.Month);
    const [collapsedParents, setCollapsedParents] = useState({});
    const [dynamicColumns, setDynamicColumns] = useState([]);

    // Estado para guardar el ancho actual de las columnas
    const [columnWidths, setColumnWidths] = useState(
        defaultColumnsDef.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultSize }), {})
    );

    // ESTADO Y REFS PARA REDIMENSIONAMIENTO DE COLUMNAS
    const [resizingColumnId, setResizingColumnId] = useState(null);
    const initialResizeX = useRef(0);
    const initialColumnWidth = useRef(0);

    // ESTADO Y REFS PARA REDIMENSIONAMIENTO DEL SPLITTER
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef(null);

    // --- REFS DE SCROLL ---
    const tableScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);

    // --- LÓGICA DE PROCESAMIENTO DE TAREAS ---
    // 1. Calcular el índice jerárquico
    const indexedTasks = useMemo(() => calculateTaskIndices(tasks), [tasks]);
    
    // 2. Aplicar la lógica de Ruta Crítica (Mock)
    const { fullTaskData: tasksWithCpm, criticalTasks } = useCriticalPathData(indexedTasks);


    // --- UTILITIES Y HANDLERS ---
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
            // Si es padre, recursivamente calcular su progreso antes de usarlo en el peso
            const childProgress = child.parentId ? calculateAggregatedProgress(child.id, currentTasks) : child.progress;
            totalWeightedProgress += (childProgress * duration);
            totalDuration += duration;
        }
        return totalDuration === 0 ? 0 : Math.round(totalWeightedProgress / totalDuration);
    }, []);

    const createNewTask = useCallback((currentTasks, parentId, isMilestone) => {
        const id = generateUniqueId(currentTasks);
        const today = new Date().toISOString().split('T')[0];
        const endDate = isMilestone ? today : addDays(today, 4);

        return {
            id: id, name: isMilestone ? `Hito ${id}` : `Tarea ${id}`, start: today, end: endDate,
            progress: isMilestone ? 100 : 0, parentId: parentId, cost: 100, priority: isMilestone ? 'Alta' : 'Media',
            dependencies: parentId || '', isMilestone: isMilestone,
        };
    }, []);

    const addNewTask = useCallback((parentId = null) => {
        setTasks(prevTasks => {
            const newTask = createNewTask(prevTasks, parentId, false);
            let newTasks = [...prevTasks];
            if (parentId) {
                const lastDescendantIndex = findLastDescendantIndex(parentId, newTasks);
                if (lastDescendantIndex !== -1) newTasks.splice(lastDescendantIndex + 1, 0, newTask);
                else newTasks.push(newTask);
                newTasks = rollupDates(parentId, newTasks);
            } else { newTasks.push(newTask); }
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
                newTasks = rollupDates(parentId, newTasks);
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

            // Mock: Actualizar la tarea padre con el nuevo progreso calculado
            if (modifiedTask && modifiedTask.parentId && columnId === 'progress') {
                let parentIdToUpdate = modifiedTask.parentId;
                while (parentIdToUpdate) {
                    const progress = calculateAggregatedProgress(parentIdToUpdate, updatedTasks);
                    updatedTasks = updatedTasks.map(t => t.id === parentIdToUpdate ? { ...t, progress } : t);
                    const parentTask = updatedTasks.find(t => t.id === parentIdToUpdate);
                    parentIdToUpdate = parentTask ? parentTask.parentId : null;
                }
            }

            return updatedTasks;
        });
    }, [rollupDates, calculateAggregatedProgress]);

    const addDynamicColumn = () => {
        const newColumnId = `Custom${dynamicColumns.length + 1}`;
        const newColumn = {
            id: newColumnId, header: `Campo ${dynamicColumns.length + 1}`, defaultSize: 150, accessorKey: newColumnId,
        };
        setDynamicColumns(prev => [...prev, newColumn]);

        setColumnWidths(prev => ({ ...prev, [newColumnId]: newColumn.defaultSize }));

        setTasks(prevTasks => prevTasks.map(task => ({ ...task, [newColumnId]: 'Nuevo Valor' })));
    };

    // --- LÓGICA DE REDIMENSIONAMIENTO DE COLUMNAS ---
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


    // --- LÓGICA DE REDIMENSIONAMIENTO DEL SPLITTER ---
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

    // --- LÓGICA DE UI Y MEMOIZACIÓN ---
    const columns = useMemo(() => [...defaultColumnsDef, ...dynamicColumns], [dynamicColumns]);

    const parentIds = useMemo(() => {
        // Tareas que son padres (ya sea porque tienen hijos o para el rollup)
        const parentsThatHaveChildren = tasksWithCpm.map(t => t.parentId).filter(Boolean);
        const allPossibleParents = tasksWithCpm.filter(t => !t.isMilestone).map(t => t.id);
        return new Set([...parentsThatHaveChildren, ...allPossibleParents]);
    }, [tasksWithCpm]);

    const visibleTasks = useMemo(() => {
        if (tasksWithCpm.length === 0) return [];
        return tasksWithCpm.filter((task) => !isTaskHidden(task, collapsedParents, tasksWithCpm));
    }, [tasksWithCpm, collapsedParents]);

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


    // --- ESTILOS INLINE ---
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


    // --- RENDERIZADO PRINCIPAL ---
    return (
        <div style={mainAppStyle}>
            <h1 style={headerStyle}>Gestor de Proyectos (Ruta Crítica)</h1>

            {/* Controles */}
            <div style={controlsContainerStyle}>
                <div style={controlItemStyle}>
                    <button onClick={() => addNewTask(null)} style={buttonStyle}>+ Tarea Principal</button>
                </div>
                <div style={controlItemStyle}>
                    <button onClick={addDynamicColumn} style={secondaryButtonStyle}>+ Columna</button>
                </div>

                <p style={{ ...controlItemStyle, color: '#4B5563', margin: 0, fontWeight: '500' }}>
                    **Ruta Crítica (Tareas Principales):** <span style={{ color: '#DC2626', fontWeight: 'bold' }}>{criticalTasks.join(', ') || 'Calculando...'}</span>
                </p>

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

            {/* Panel de Split (Referenciado por containerRef) */}
            <div ref={containerRef} style={splitContainerStyle}>

                {/* PANEL IZQUIERDO: TABLA DE TAREAS */}
                <div style={{ width: `${leftPanelWidth}%`, flexShrink: 0 }}>
                    <div ref={tableScrollRef} style={tableContainerStyle} onScroll={onTableScroll}>
                        <table style={{ minWidth: totalTableWidth, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                            <thead>
                                <tr style={tableHeaderRowStyle}>
                                    {columns.map(column => (
                                        <th key={column.id} style={tableHeaderCellStyle(column.id)}>
                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%' }}>
                                                {column.header}
                                                {/* RESIZE HANDLE PARA COLUMNAS */}
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
                                                    allTasks={tasksWithCpm}
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

                {/* SPLITTER - MANEJADOR DE ARRASTRE */}
                <div
                    onMouseDown={startResize}
                    onTouchStart={startResize}
                    style={{ width: '10px', cursor: 'col-resize', backgroundColor: '#D1D5DB', flexShrink: 0 }}
                />

                {/* PANEL DERECHO: VISTA GANTT */}
                <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                    <CustomGantt
                        tasks={visibleTasks}
                        viewMode={viewMode}
                        scrollRef={ganttScrollRef}
                        onScroll={onGanttScroll}
                    />

                </div>
            </div>

            {/* Aplicar cursor de redimensionamiento a nivel global mientras se arrastra */}
            {(resizingColumnId || isResizing) && (
                <style>{`body { cursor: col-resize !important; user-select: none; }`}</style>
            )}
        </div>

    );
};

export default ProjectGanttApp;