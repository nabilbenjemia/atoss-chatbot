
export default function UserMessage({ message }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[60%] bg-tum-blue text-white rounded-lg p-3">
        <p className="text-sm whitespace-pre-wrap">{message}</p>
      </div>
    </div>
  );
}