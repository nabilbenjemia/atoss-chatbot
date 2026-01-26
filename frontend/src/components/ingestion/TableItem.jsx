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
            <div className="bg-tum-blue-light-5 p-4 border border-tum-grey-7 opacity-60">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-tum-orange font-bold uppercase">Deleted</span>
                    {onRestore && (
                        <button
                            onClick={() => onRestore(item.id)}
                            className="px-3 py-1 text-xs font-bold bg-white border border-tum-blue 
                                text-tum-blue hover:bg-tum-blue hover:text-white transition-colors"
                        >
                            Restore
                        </button>
                    )}
                </div>
                <div className="mt-2 h-16 bg-tum-grey-8 flex items-center justify-center">
                    <span className="text-tum-grey-4 text-sm">Table deleted</span>
                </div>
            </div>
        );
    }

    if (!tableData || !tableData.headers || !tableData.rows) {
        return (
            <div className="bg-white p-4 border border-tum-grey-7">
                <p className="text-sm text-tum-grey-4">Invalid table data</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 border border-tum-grey-7 group hover:border-tum-blue transition-colors">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-tum-grey-7 border border-tum-grey-7">
                    <thead className="bg-tum-blue-light-5">
                        <tr>
                            {tableData.headers.map((header, i) => (
                                <th
                                    key={i}
                                    className="px-4 py-2 text-left text-xs font-bold text-tum-black uppercase tracking-wider"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-tum-grey-7">
                        {tableData.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-tum-blue-light-5 transition-colors">
                                {row.map((cell, j) => (
                                    <td
                                        key={j}
                                        className="px-4 py-2 text-sm text-tum-black whitespace-nowrap"
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
            <div className="flex items-center justify-end space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                {onDelete && (
                    <button
                        onClick={() => onDelete(item.id)}
                        className="px-3 py-1 text-xs font-bold bg-white border border-tum-orange 
                            text-tum-orange hover:bg-tum-orange hover:text-white transition-colors"
                    >
                        🗑️ Delete
                    </button>
                )}
            </div>
        </div>
    );
}
