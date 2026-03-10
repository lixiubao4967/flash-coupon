import VoicePublisher from '@/components/VoicePublisher';

export default function VoicePage() {
  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">语音发布优惠</h1>
        <p className="text-sm text-gray-500 mt-1">
          说出你的优惠，AI 自动解析，一键发布扩散
        </p>
      </div>
      <VoicePublisher />
    </div>
  );
}
