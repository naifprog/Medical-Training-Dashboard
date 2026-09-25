import { useState } from "react";
import Icon from "../Icon";
import { useUI } from "../../context/UIContext";
import { api } from "../../api/client";

export default function QuizPanel({ device, progress, onProgressChange, onViewCert }) {
  const { t, lang } = useUI();
  const questions = device.quiz || [];
  const passingScore = device.passingScore ?? 80;
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!questions.length) return <div className="card p-6 text-sm txt-muted text-center">{t("common_none")}</div>;

  async function submit() {
    setBusy(true);
    try {
      // The server is the sole source of truth for scoring/correctness --
      // this response's `breakdown` is what's rendered below, never a
      // client-side recomputation of the answers the trainee just typed.
      const data = await api.post(`/progress/${device.id}/quiz/submit`, { answers });
      onProgressChange(data.progress);
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  function retry() { setAnswers({}); setResult(null); }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="card p-6 text-center">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3" style={{ background: result.passed ? "var(--green-bg)" : "var(--red-bg)", color: result.passed ? "var(--green)" : "var(--red)" }}>
            <Icon name={result.passed ? "check" : "x"} size={28} />
          </div>
          <div className="font-head text-2xl font-bold mb-1">{result.score}%</div>
          <div className="text-sm font-semibold mb-1" style={{ color: result.passed ? "var(--green)" : "var(--red)" }}>{result.passed ? t("quiz_pass") : t("quiz_fail")}</div>
          <div className="text-xs txt-muted mb-4">
            {t("quiz_correct_count")}: {result.correctCount}/{result.totalQuestions} · {t("quiz_passing_required")}: {result.passingScore}%
          </div>
          <div className="flex items-center justify-center gap-2">
            <button className="btn btn-outline" onClick={retry}><Icon name="rotate" size={15} />{t("quiz_retry")}</button>
            {result.passed && <button className="btn btn-primary" onClick={onViewCert}><Icon name="award" size={15} />{t("quiz_viewCert")}</button>}
          </div>
        </div>

        <div className="space-y-3">
          {(result.breakdown || []).map((r) => (
            <div key={r.questionIndex} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold text-sm">{r.questionIndex + 1}. {r.question}</div>
                {r.correct
                  ? <span className="badge badge-pass shrink-0"><Icon name="check" size={11} />{lang === "ar" ? "صحيحة" : "Correct"}</span>
                  : <span className="badge badge-fail shrink-0"><Icon name="x" size={11} />{lang === "ar" ? "خاطئة" : "Incorrect"}</span>}
              </div>
              <div className="text-xs space-y-1">
                <div className="txt-muted">
                  {t("quiz_your_answer")}: <span className="font-medium" style={{ color: r.correct ? "var(--green)" : "var(--red)" }}>
                    {r.selectedIndex != null ? r.options[r.selectedIndex] : t("quiz_no_answer")}
                  </span>
                </div>
                {!r.correct && (
                  <div className="txt-muted">
                    {t("quiz_correct_answer")}: <span className="font-medium" style={{ color: "var(--green)" }}>{r.options[r.correctIndex]}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs txt-muted">{t("quiz_passing_required")}: {passingScore}%</div>
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
