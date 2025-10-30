import React from 'react';

// --- Datos de Ejemplo ---
const projectData = [
    { id: '#001', name: 'Desarrollo de App Móvil', manager: 'Ana Torres', status: 'Completado', priority: 'Alta' },
    { id: '#002', name: 'Campaña de Marketing Q4', manager: 'Beto Sanz', status: 'En Progreso', priority: 'Media' },
    { id: '#003', name: 'Actualización de Servidores', manager: 'Carlos Ruíz', status: 'Pendiente', priority: 'Crítica' },
    { id: '#004', name: 'Revisión de Contratos Legales', manager: 'Diana Soto', status: 'Completado', priority: 'Baja' },
    { id: '#005', name: 'Diseño de Nueva Web', manager: 'Eva Mendez', status: 'En Progreso', priority: 'Alta' },
    { id: '#006', name: 'Capacitación de Empleados', manager: 'Felipe Guzmán', status: 'Pendiente', priority: 'Media' },
];

// --- Función para obtener el estilo de la insignia de estado ---
const getStatusBadge = (status) => {
    switch (status) {
        case 'Completado':
            return 'bg-green-100 text-green-800';
        case 'En Progreso':
            return 'bg-yellow-100 text-yellow-800';
        case 'Pendiente':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

// --- Componente principal ---
const TableOnlyApp = () => {
    // Definición de las columnas de la tabla
    const columns = [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Nombre del Proyecto' },
        { key: 'manager', header: 'Gerente' },
        { key: 'status', header: 'Estado' },
        { key: 'priority', header: 'Prioridad' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-extrabold text-indigo-700 mb-6">Lista de Proyectos (React)</h1>

                {/* Contenedor de la tabla con scroll horizontal para móviles */}
                <div className="bg-white shadow-2xl rounded-xl overflow-x-auto border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        {/* Encabezado */}
                        <thead className="bg-indigo-600 text-white">
                            <tr>
                                {columns.map((col, index) => (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider ${index === 0 ? 'rounded-tl-xl' : ''
                                            } ${index === columns.length - 1 ? 'rounded-tr-xl' : ''
                                            }`}
                                    >
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        {/* Cuerpo de la tabla */}
                        <tbody className="divide-y divide-gray-100">
                            {projectData.map((project, index) => (
                                <tr
                                    key={project.id}
                                    // Alterna los colores de las filas para mejorar la legibilidad
                                    className={`transition duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                        } hover:bg-indigo-50`}
                                >
                                    {/* Celda ID */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {project.id}
                                    </td>

                                    {/* Celda Nombre */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {project.name}
                                    </td>

                                    {/* Celda Gerente */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {project.manager}
                                    </td>

                                    {/* Celda Estado (con Insignia) */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(project.status)}`}>
                                            {project.status}
                                        </span>
                                    </td>

                                    {/* Celda Prioridad */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="text-indigo-600 font-semibold">
                                            {project.priority}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="mt-6 text-sm text-gray-500">
                    Esta tabla está diseñada para ser completamente responsiva. En pantallas pequeñas, el contenido se desplaza horizontalmente.
                </p>
            </div>
        </div>
    );
};

export default TableOnlyApp;
