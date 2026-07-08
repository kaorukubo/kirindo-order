'use client';

interface Props {
  testMode: boolean;
  onTestModeChange: (v: boolean) => void;
  onInjectTestData: () => void;
}

export default function TestModeBar({ testMode, onTestModeChange, onInjectTestData }: Props) {
  return (
    <div className={`test-mode-bar ${testMode ? 'test-mode-bar--on' : ''}`}>
      <label className="test-mode-toggle">
        <input
          type="checkbox"
          checked={testMode}
          onChange={(e) => onTestModeChange(e.target.checked)}
        />
        <span className="test-mode-switch" aria-hidden />
        <span className="test-mode-label">テストモード</span>
        {testMode && <span className="test-mode-badge">ON — 本番DB未更新</span>}
      </label>

      {testMode && (
        <button type="button" className="test-mode-inject" onClick={onInjectTestData}>
          テストデータを自動注入
        </button>
      )}
    </div>
  );
}
