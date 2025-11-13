
export default function AIMessage({ message }) {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[60%] bg-gray-200 text-black rounded-lg p-3">
        <p className="text-sm whitespace-pre-wrap">{message}</p>
      </div>
    </div>
  );
}