import { useState } from "react";
import Icon from "../Icon";
import { useUI } from "../../context/UIContext";
import { api } from "../../api/client";

export default function QuizPanel({ device, progress, onProgressChange, onViewCert }) {
  const { t, lang } = useUI();
  const questions = device.quiz || [];
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!questions.length) return <div className="card p-6 text-sm txt-muted text-center">{t("common_none")}</div>;

  async function submit() {
    setBusy(true);
    try {
      const { progress: updated, score, passed } = await api.post(`/progress/${device.id}/quiz/submit`, { answers });
      onProgressChange(updated);
      setResult({ score, passed });
    } finally {
      setBusy(false);
    }
  }

  function retry() { setAnswers({}); setResult(null); }

  if (result) {
    return (
      <div className="card p-6 text-center">
        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3" style={{ background: result.passed ? "var(--green-bg)" : "var(--red-bg)", color: result.passed ? "var(--green)" : "var(--red)" }}>
          <Icon name={result.passed ? "check" : "x"} size={28} />
        </div>
        <div className="font-head text-2xl font-bold mb-1">{result.score}%</div>
        <div className="text-sm font-semibold mb-4" style={{ color: result.passed ? "var(--green)" : "var(--red)" }}>{result.passed ? t("quiz_pass") : t("quiz_fail")}</div>
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-outline" onClick={retry}><Icon name="rotate" size={15} />{t("quiz_retry")}</button>
          {result.passed && <button className="btn btn-primary" onClick={onViewCert}><Icon name="award" size={15} />{t("quiz_viewCert")}</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs txt-muted">{t("quiz_threshold")}</div>
      {questions.map((q, qi) => (
        <div key={qi} className="card p-4">
          <div className="font-semibold text-sm mb-3">{qi + 1}. {q.question}</div>
          <div className="space-y-2">
            {q.options.map((o, oi) => (
              <label key={oi} className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer text-sm surface2" style={answers[qi] === oi ? { background: "var(--teal-soft)", border: "1px solid var(--teal)" } : {}}>
                <input type="radio" name={"q" + qi} checked={answers[qi] === oi} onChange={() => setAnswers((a) => ({ ...a, [qi]: oi }))} />
                {o}
              </label>
            ))}
          </div>
        </div>
      ))}
      {progress?.quizPassed && (
        <div className="flex items-center gap-2 text-xs rounded-lg p-3" style={{ background: "var(--green-bg)", color: "var(--green)" }}>
          <Icon name="check" size={14} />{lang === "ar" ? "لقد اجتزت هذا التقييم مسبقاً. يمكنك إعادة المحاولة لتحسين نتيجتك." : "You've already passed this evaluation. You may retake it to improve your score."}
        </div>
      )}
      <button className="btn btn-primary w-full justify-center" disabled={Object.keys(answers).length < questions.length || busy} onClick={submit}>
        {busy ? t("common_loading") : t("quiz_submit")}
      </button>
    </div>
  );
}
