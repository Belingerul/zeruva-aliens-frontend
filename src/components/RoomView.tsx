import AlienMenu from "./AlienMenu";

export default function RoomView() {
  return (
    <div className="flex-1 rounded-xl p-6 bg-black/60 backdrop-blur-sm border border-gray-800">
      <div className="h-full min-h-[500px]">
        <AlienMenu />
      </div>
    </div>
  );
}
