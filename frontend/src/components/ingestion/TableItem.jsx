/**
 * TableItem Component
 * 
 * Displays table content in a formatted table view.
 * Read-only for now (editing could be added later).
 */

/**
 * @param {Object} props
 * @param {Object} props.item - Table item object { id, type, tableData, deleted }
 * @param {Function} props.onDelete - Delete handler (itemId)
 * @param {Function} props.onRestore - Restore handler (itemId)
 */
export default function TableItem({
    item,
    onDelete,
    onRestore,
}) {
    const { tableData } = item;

    // Deleted state
    if (item.deleted) {
        return (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-tum-grey-7 opacity-50">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-red-500 font-medium">Deleted</span>
                    {onRestore && (
                        <button
                            onClick={() => onRestore(item.id)}
                            className="text-xs text-tum-blue hover:text-tum-dark-blue"
                        >
                            Restore
                        </button>
                    )}
                </div>
                <div className="mt-2 h-16 bg-tum-grey-20 rounded flex items-center justify-center">
                    <span className="text-tum-grey-4 text-sm">Table deleted</span>
                </div>
            </div>
        );
    }

    if (!tableData || !tableData.headers || !tableData.rows) {
        return (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-tum-grey-7">
                <p className="text-sm text-tum-grey-4">Invalid table data</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-tum-grey-7 group">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-tum-grey-7">
                    <thead className="bg-tum-grey-20">
                        <tr>
                            {tableData.headers.map((header, i) => (
                                <th
                                    key={i}
                                    className="px-4 py-2 text-left text-xs font-medium text-tum-grey-1 uppercase tracking-wider"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-tum-grey-7">
                        {tableData.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-tum-grey-20 transition-colors">
                                {row.map((cell, j) => (
                                    <td
                                        key={j}
                                        className="px-4 py-2 text-sm text-tum-grey-1 whitespace-nowrap"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end space-x-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {onDelete && (
                    <button
                        onClick={() => onDelete(item.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                    >
                        🗑️ Delete
                    </button>
                )}
            </div>
        </div>
    );
}
