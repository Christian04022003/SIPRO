import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table';
import { FrappeGantt, ViewMode } from '@toyokoh/frappe-gantt-react';

// NOTA: Para el entorno de archivo único, los estilos externos han sido integrados
// o reemplazados por Tailwind CSS/estilos inline para garantizar el layout.

// Usamos createColumnHelper para definir las columnas de forma más flexible
const columnHelper = createColumnHelper();

// --- TAREAS INICIALES ---
const initialTasks = [
    { id: 'T1', name: 'Fase de Planificación', start: '2025-11-01', end: '2025-11-15', progress: 100, parentId: null, cost: 5000, priority: 'Alta' },
    { id: 'S1-1', name: 'Definir Alcance', start: '2025-11-01', end: '2025-11-07', progress: 100, parentId: 'T1', cost: 2000, priority: 'Media' },
    { id: 'S1-2', name: 'Requisitos de Stakeholders', start: '2025-11-08', end: '2025-11-15', progress: 90, parentId: 'T1', cost: 3000, priority: 'Alta' },
    { id: 'T2', name: 'Desarrollo Core', start: '2025-11-16', end: '2025-12-10', progress: 70, parentId: null, dependencies: 'T1', cost: 15000, priority: 'Alta' },
    { id: 'S2-1', name: 'Codificación Módulo A', start: '2025-11-16', end: '2025-11-30', progress: 80, parentId: 'T2', cost: 5000, priority: 'Alta' },
    { id: 'S2-2', name: 'Integración de API', start: '2025-11-16', end: '2025-12-10', progress: 50, parentId: 'T2', cost: 10000, priority: 'Media' },
    { id: 'T3', name: 'Pruebas e Implementación', start: '2025-12-11', end: '2025-12-30', progress: 30, parentId: null, dependencies: 'T2', cost: 8000, priority: 'Baja' },
    { id: 'S3-1', name: 'Beta Testing', start: '2025-12-11', end: '2025-12-20', progress: 50, parentId: 'T3', cost: 3000, priority: 'Media' },
    { id: 'S3-2', name: 'Despliegue Final', start: '2025-12-21', end: '2025-12-30', progress: 10, parentId: 'T3', cost: 5000, priority: 'Alta' },
];

// --- LÓGICA DE HERRAMIENTAS ---
const getTaskDepth = (task, allTasks, depth = 0) => {
    if (!task.parentId) return depth;
    const parent = allTasks.find(t => t.id === task.parentId);
    return parent ? getTaskDepth(parent, allTasks, depth + 1) : depth;
};

// Lógica para verificar si una tarea está oculta por un ancestro colapsado
const isTaskHidden = (task, collapsedParents, allTasks) => {
    let currentTask = task;
    while (currentTask.parentId) {
        if (collapsedParents[currentTask.parentId]) {
            return true;
        }
        currentTask = allTasks.find(t => t.id === currentTask.parentId);
        if (!currentTask) break;
    }
    return false;
};


// --- COMPONENTE DE CELDA EDITABLE ---
const EditableCell = ({ getValue, row, column, allTasks, updateTaskData, parentIds, collapsedParents, toggleCollapse }) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const onBlur = () => {
        setIsEditing(false);
        if (value !== initialValue) {
            updateTaskData(row.original.id, column.id, value);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onBlur();
        } else if (e.key === 'Escape') {
            setValue(initialValue);
            setIsEditing(false);
        }
    };

    const handleDoubleClick = () => {
        // Solo permite la edición si no es la columna 'name' o si es la columna 'name' pero no es un padre colapsado.
        if (column.id !== 'name' || !collapsedParents[row.original.id]) {
            setIsEditing(true);
            // Pequeño timeout para asegurar que el input se ha renderizado
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    };

    // --- Renderizado del input para edición ---
    if (isEditing) {
        return (
            <input
                ref={inputRef}
                // Si la columna es 'cost' o 'progress', limpia el formato para editar
                value={column.id === 'cost' ? String(value).replace(/[^0-9.]/g, '') : column.id === 'progress' ? String(value).replace(/[^0-9.]/g, '') : value}
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={handleKeyDown}
                className="w-full h-full p-1 border-indigo-500 border rounded box-border focus:outline-none"
                style={{ backgroundColor: 'white' }}
                type={column.id === 'cost' || column.id === 'progress' ? 'number' : 'text'}
            />
        );
    }

    // --- LÓGICA DE VISUALIZACIÓN Y COLAPSO PARA LA COLUMNA 'NAME' ---
    if (column.id === 'name') {
        const isParent = parentIds.has(row.original.id);
        const isCollapsed = collapsedParents[row.original.id];
        const depth = getTaskDepth(row.original, allTasks);

        const toggleIcon = isParent ? (
            <span
                onClick={() => toggleCollapse(row.original.id)}
                className="text-gray-500 hover:text-indigo-600 transition duration-150 flex items-center justify-center"
                style={{
                    cursor: 'pointer',
                    transition: 'transform 0.15s',
                    transform: isCollapsed ? 'rotate(90deg)' : 'rotate(0deg)',
                    lineHeight: '1',
                    fontSize: '10px', // Icono más pequeño para el triángulo
                    minWidth: '16px'
                }}
            >
                &#9658; {/* Triángulo sólido pequeño */}
            </span>
        ) : (
            // Placeholder para alinear tareas sin hijos
            <span style={{ minWidth: '16px', opacity: 0, visibility: 'hidden', fontSize: '10px' }}>&#9658;</span>
        );

        return (
            <div
                style={{
                    paddingLeft: `${depth * 20 + 8}px`,
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    height: '100%',
                    backgroundColor: isCollapsed ? '#f3f4f6' : 'transparent',
                }}
                onDoubleClick={handleDoubleClick} // El doble clic inicia la edición
                className="hover:bg-indigo-50/70"
            >
                {toggleIcon}
                <span
                    style={{ flexGrow: 1, textOverflow: 'ellipsis', overflow: 'hidden' }}
                >
                    {value}
                </span>
            </div>
        );
    }

    // --- Renderizado por defecto para otras columnas ---
    let formattedValue = value;
    if (column.id === 'cost') {
        formattedValue = `$${(parseFloat(value) || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    } else if (column.id === 'progress') {
        formattedValue = `${parseInt(value, 10) || 0}%`;
    }

    return (
        <div
            onDoubleClick={handleDoubleClick}
            className="w-full h-full flex items-center px-2 hover:bg-indigo-50/70"
        >
            {formattedValue}
        </div>
    );
};


// --- COMPONENTE PRINCIPAL ---
const GanttWithTable = () => {
    // ----------------------------------------------------
    // --- ESTADO Y MEMORIZACIÓN DE DATOS ---
    // ----------------------------------------------------
    const [tasks, setTasks] = useState(initialTasks);
    const [viewMode, setViewMode] = useState(ViewMode.Month);
    const [collapsedParents, setCollapsedParents] = useState({});
    const [selectedParentToToggle, setSelectedParentToToggle] = useState('');

    // Layout y Resizing
    const tableScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);
    const wrapperRef = useRef(null);
    const [tableWidth, setTableWidth] = useState('50%'); // Ancho inicial
    const [isResizing, setIsResizing] = useState(false);

    // Columnas Dinámicas
    const [newColumnName, setNewColumnName] = useState('');
    const [dynamicColumns, setDynamicColumns] = useState([]);

    // Determina qué tareas son padres (tienen al menos un hijo)
    const parentIds = useMemo(() => new Set(tasks.map(t => t.parentId).filter(Boolean)), [tasks]);

    // Opciones para el Picker de Filtro (Tareas de Nivel Raíz)
    const parentTasksOptions = useMemo(() => {
        const rootTasks = tasks.filter(t => !t.parentId);
        return [
            { id: '', name: 'Mostrar Todo (Expandir)' },
            ...rootTasks.map(t => ({ id: t.id, name: t.name }))
        ];
    }, [tasks]);

    // Filtra las tareas para mostrar solo las visibles en la tabla y en el Gantt
    const visibleTasks = useMemo(() => {
        return tasks.filter(task => !isTaskHidden(task, collapsedParents, tasks));
    }, [tasks, collapsedParents]);

    // ----------------------------------------------------
    // --- FUNCIONES DE COLAPSO Y FILTRADO ---
    // ----------------------------------------------------

    // Función para alternar el estado de colapso de un padre (usada por el icono de la celda)
    const toggleCollapse = useCallback((taskId) => {
        setCollapsedParents(prev => ({
            ...prev,
            [taskId]: !prev[taskId],
        }));
        // Asegura que el selector de filtro se resetee si se manipula manualmente
        setSelectedParentToToggle('');
    }, []);

    // Función para manejar la selección del picker (Filtro por tarea principal)
    const handleParentToggle = (e) => {
        const taskId = e.target.value;
        setSelectedParentToToggle(taskId);

        if (taskId === '') {
            setCollapsedParents({});
        } else {
            const newCollapsed = {};

            // Colapsa todas las tareas principales (nivel raíz) que no son la seleccionada
            tasks.forEach(task => {
                if (!task.parentId && task.id !== taskId) {
                    newCollapsed[task.id] = true;
                }
            });

            // Expande la tarea seleccionada y sus ancestros
            let taskToExpand = tasks.find(t => t.id === taskId);
            while (taskToExpand) {
                newCollapsed[taskToExpand.id] = false;
                taskToExpand = tasks.find(t => t.id === taskToExpand.parentId);
            }

            setCollapsedParents(newCollapsed);
        }
    };

    // Adaptación de tareas para FrappeGantt (solo usa las visibles)
    const ganttTasks = useMemo(() => visibleTasks.map(task => ({
        ...task,
        start: task.start,
        end: task.end,
        // FrappeGantt usa 'id' y 'name', y 'custom_class' para styling opcional
        custom_class: collapsedParents[task.id] ? 'collapsed' : '',
    })), [visibleTasks, collapsedParents]);

    // ----------------------------------------------------
    // --- FUNCIONES DE TABLA Y REDIMENSIONAMIENTO ---
    // ----------------------------------------------------

    // Función para actualizar una tarea
    const updateTaskData = useCallback((id, columnId, newValue) => {
        setTasks(prevTasks => prevTasks.map(task => {
            if (task.id === id) {
                let updatedValue = newValue;
                if (columnId === 'cost' || columnId === 'progress') {
                    // Limpia el valor antes de convertir a número
                    updatedValue = parseFloat(String(newValue).replace(/[^0-9.]/g, ''));
                    if (isNaN(updatedValue)) updatedValue = 0;
                    if (columnId === 'progress') updatedValue = Math.min(100, Math.max(0, updatedValue));
                }
                return { ...task, [columnId]: updatedValue };
            }
            return task;
        }));
    }, []);

    // Definición de las columnas fijas
    const defaultColumns = useMemo(() => [
        columnHelper.accessor('name', {
            header: 'Nombre de Tarea',
            size: 250,
            minSize: 150,
            cell: props => (
                <EditableCell
                    {...props}
                    allTasks={tasks}
                    updateTaskData={updateTaskData}
                    parentIds={parentIds}
                    collapsedParents={collapsedParents}
                    toggleCollapse={toggleCollapse}
                />
            ),
        }),
        columnHelper.accessor('cost', {
            header: 'Costo (USD)',
            size: 100,
            cell: props => (
                <EditableCell
                    {...props}
                    allTasks={tasks}
                    updateTaskData={updateTaskData}
                />
            ),
        }),
        columnHelper.accessor('progress', {
            header: 'Progreso (%)',
            size: 100,
            cell: props => (
                <EditableCell
                    {...props}
                    allTasks={tasks}
                    updateTaskData={updateTaskData}
                />
            ),
        }),
    ], [tasks, updateTaskData, parentIds, collapsedParents, toggleCollapse]);

    // Todas las columnas: Fijas + Dinámicas
    const columns = useMemo(() => [
        ...defaultColumns,
        ...dynamicColumns.map(col => columnHelper.accessor(col.accessorKey, {
            header: col.header,
            size: 120,
            cell: props => (
                <EditableCell
                    {...props}
                    allTasks={tasks}
                    updateTaskData={updateTaskData}
                />
            ),
        }))
    ], [defaultColumns, dynamicColumns, tasks, updateTaskData]);


    // Lógica para agregar columnas
    const handleAddColumn = () => {
        if (!newColumnName.trim()) return;
        const accessorKey = newColumnName.trim().toLowerCase().replace(/\s+/g, '_');

        if (columns.some(col => col.accessorKey === accessorKey || col.id === accessorKey)) {
            console.error('La columna ya existe.');
            setNewColumnName('');
            return;
        }

        const newCol = {
            header: newColumnName.trim(),
            accessorKey: accessorKey,
        };
        setDynamicColumns(prev => [...prev, newCol]);

        // Inicializa el valor de la nueva columna en todas las tareas
        setTasks(prevTasks => prevTasks.map(task => ({
            ...task,
            [accessorKey]: 'Nuevo Valor', // Valor inicial para la nueva columna
        })));

        setNewColumnName('');
    };


    // Lógica de redimensionado (Se mantiene el código original, que es correcto)
    const startResize = useCallback((e) => {
        setIsResizing(true);
        e.preventDefault();
    }, []);

    const onResize = useCallback((e) => {
        if (!isResizing || !wrapperRef.current) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const wrapperBounds = wrapperRef.current.getBoundingClientRect();
        const newWidth = ((clientX - wrapperBounds.left) / wrapperBounds.width) * 100;

        // Limita el ancho de la tabla entre 20% y 80%
        if (newWidth > 20 && newWidth < 80) {
            setTableWidth(`${newWidth}%`);
        }
    }, [isResizing]);

    const stopResize = useCallback(() => {
        setIsResizing(false);
    }, []);

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
            window.removeEventListener('touchmove', stopResize);
            window.removeEventListener('touchend', stopResize);
        };
    }, [isResizing, onResize, stopResize]);


    // Lógica de la tabla TanStack
    const table = useReactTable({
        data: visibleTasks,
        columns,
        getCoreRowModel: getCoreRowModel(),
        columnResizeMode: 'onChange',
        defaultColumn: {
            minSize: 50,
        },
    });

    // Lógica de scroll sincronizado (Mantiene el código original)
    const handleScroll = (scrollingElement, targetRef) => {
        // Solo sincroniza el scroll vertical (scrollTop)
        if (targetRef.current && scrollingElement !== targetRef.current) {
            targetRef.current.scrollTop = scrollingElement.scrollTop;
        }
    };

    const onTableScroll = (e) => handleScroll(e.currentTarget, ganttScrollRef);
    const onGanttScroll = (e) => handleScroll(e.currentTarget, tableScrollRef);


    return (
        <div className="gantt-combined-view bg-gray-50 min-h-screen p-4 sm:p-6 rounded-lg">


            <h1 className="text-2xl font-extrabold mb-4 text-indigo-700">Planificador de Proyectos Interactivo (Gantt)</h1>

            <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-white rounded-xl shadow-lg border border-gray-100">
                {/* Selector de Zoom */}
                <div>
                    <label className="font-semibold text-sm text-gray-700 mr-2">Zoom:</label>
                    <select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                        className="py-1 px-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150"
                    >
                        <option value={ViewMode.Day}>Día</option>
                        <option value={ViewMode.Week}>Semana</option>
                        <option value={ViewMode.Month}>Mes</option>
                        <option value={ViewMode.Year}>Año</option>
                    </select>
                </div>

                {/* PICKER DE COLAPSADO/FILTRO */}
                <div>
                    <label className="font-semibold text-sm text-gray-700 mr-2">Filtrar por Tarea Principal:</label>
                    <select
                        value={selectedParentToToggle}
                        onChange={handleParentToggle}
                        className="py-1 px-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-150 bg-white"
                    >
                        {parentTasksOptions.map(option => (
                            <option key={option.id} value={option.id}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Entrada para Agregar Columnas */}
                <div className="flex space-x-2">
                    <input
                        type="text"
                        placeholder="Nueva Columna"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        className="py-1 px-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                        onClick={handleAddColumn}
                        disabled={!newColumnName.trim()}
                        className={`px-4 py-1.5 rounded-lg text-white font-medium shadow-md transition duration-150 ${newColumnName.trim() ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Columna
                    </button>
                </div>
            </div>

            {/* --- CONTENEDOR DE PANELES: SOLUCIÓN DEL LAYOUT --- */}
            {/* Se agrega 'flex-row' para ser explícito, aunque 'flex' lo hace por defecto,
                y se asegura que ocupe todo el espacio disponible del padre. */}
            <div
                className="flex flex-row w-full h-[500px] overflow-hidden relative shadow-xl rounded-xl border border-gray-200 bg-white"
                ref={wrapperRef}
            >

                {/* -------------------- PANE IZQUIERDO: TANSTACK TABLE -------------------- */}
                <div
                    ref={tableScrollRef}
                    // Importante: flex-shrink-0 previene que la tabla se colapse,
                    // y overflow-y-scroll permite el scroll vertical.
                    className="flex-shrink-0 overflow-y-scroll h-full border-r border-gray-300"
                    onScroll={onTableScroll}
                    style={{ width: tableWidth, minWidth: '20%' }}
                >
                    <table className="task-table" style={{ width: table.getTotalSize() }}>
                        <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            colSpan={header.colSpan}
                                            style={{ width: header.getSize() }}
                                        >
                                            {/* Header de la columna */}
                                            {header.isPlaceholder ? null : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            {/* Indicador de Resize de Columna */}
                                            <div
                                                onMouseDown={header.getResizeHandler()}
                                                onTouchStart={header.getResizeHandler()}
                                                className={`resizer ${header.column.getIsResizing() ? 'isResizing' : ''
                                                    }`}
                                            />
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {/* Renderiza solo las filas de tareas visibles */}
                            {table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="border-b border-gray-100 hover:bg-indigo-50/50 transition duration-100">
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="p-0 align-top">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* -------------------- DIVISOR ARRASTRABLE -------------------- */}
                {/* Se mueve el divisor entre los dos paneles y se asegura que no se comprima (flex-shrink-0) */}
                <div
                    className="w-2 bg-gray-300 cursor-col-resize hover:bg-indigo-500 transition duration-150 flex-shrink-0 z-10"
                    onMouseDown={startResize}
                    onTouchStart={startResize}
                    title="Arrastrar para redimensionar la tabla"
                />

                {/* -------------------- PANE DERECHO: FRAPPE GANTT -------------------- */}
                {/* <div
                    ref={ganttScrollRef}
                    // Importante: flex-grow asegura que tome el espacio restante
                    className="flex-grow overflow-y-scroll h-full"
                    onScroll={onGanttScroll}
                >

                    <FrappeGantt tasks={ganttTasks} viewMode={viewMode} />
                </div> */}
            </div>
        </div>
    );
};

export default GanttWithTable;
