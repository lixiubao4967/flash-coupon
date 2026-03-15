import VoicePublisher from '@/components/VoicePublisher';

export default function VoicePage() {
  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* 页头 */}
      <div>
        <h1 className="text-2xl font-black text-gray-800">语音发布优惠</h1>
        <p className="text-sm text-gray-400 mt-1">
          说出你的优惠，AI 自动解析，一键发布扩散
        </p>
      </div>

      {/* Voice Publisher Card */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
        <VoicePublisher />
      </div>
    </div>
  );
}
