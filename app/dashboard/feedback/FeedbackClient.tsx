"use client";

import { useState, FormEvent, useCallback } from "react";
import { doc, getDoc, getDocs, collection, query, where, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Feedback, UserProfile } from "@/types";
import { formatTargetSunday } from "@/lib/date";
import { WeekPicker } from "@/components/WeekPicker";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/context/ToastContext";

interface FeedbackClientProps {
  user: UserProfile;
  currentSunday: string;
  initialMyFeedback: Feedback | null;
  initialAllFeedback: Feedback[];
  usersMap: Record<string, string>;
  isPastor: boolean;
}

export function FeedbackClient({
  user,
  currentSunday,
  initialMyFeedback,
  initialAllFeedback,
  usersMap,
  isPastor,
}: FeedbackClientProps) {
  const { success, error } = useToast();

  const [targetSunday, setTargetSunday] = useState(currentSunday);
  const isReadOnly = targetSunday !== currentSunday;

  const [myFeedback, setMyFeedback] = useState<Feedback | null>(initialMyFeedback);
  const [draft, setDraft] = useState(initialMyFeedback?.content ?? "");
  const [submitting, setSubmitting] = useState(false);

  const [allFeedback, setAllFeedback] = useState<Feedback[]>(initialAllFeedback);
  const [fetching, setFetching] = useState(false);

  const fetchForWeek = useCallback(async (dateStr: string) => {
    setFetching(true);
    try {
      const myDocId = `${dateStr}_${user.uid}`;
      const mySnap = await getDoc(doc(db, "feedback", myDocId)).catch(() => null);
      
      if (mySnap?.exists()) {
        const data = { id: mySnap.id, ...mySnap.data() } as Feedback;
        setMyFeedback(data);
        setDraft(data.content);
      } else {
        setMyFeedback(null);
        setDraft("");
      }

      const allSnap = await getDocs(
        query(collection(db, "feedback"), where("service_date", "==", dateStr))
      );
      
      setAllFeedback(allSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Feedback)));
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  }, [user.uid]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || isReadOnly) return;
    setSubmitting(true);

    try {
      const docId = `${targetSunday}_${user.uid}`;
      const isNew = !myFeedback;

      const ts = serverTimestamp();
      
      await setDoc(
        doc(db, "feedback", docId),
        {
          user_id: user.uid,
          service_date: targetSunday,
          content: draft.trim(),
          ...(isNew ? { submitted_at: ts } : { updated_at: ts }),
        },
        { merge: true }
      );

      const newFeedbackData = {
        id: docId,
        user_id: user.uid,
        service_date: targetSunday,
        content: draft.trim(),
        submitted_at: isNew ? (new Date() as any) : myFeedback!.submitted_at,
        updated_at: !isNew ? (new Date() as any) : undefined,
      };

      setMyFeedback(newFeedbackData);
      
      // Update the allFeedback list locally
      setAllFeedback(prev => {
        const filtered = prev.filter(f => f.user_id !== user.uid);
        return [...filtered, newFeedbackData];
      });
      
      success(isNew ? "Feedback submitted" : "Feedback updated");
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  const isEdit = Boolean(myFeedback);
  
  const sortedFeedback = [...allFeedback].sort((a, b) => {
    // Handle both client Timestamps and server Timestamps gracefully for sorting
    const getMs = (ts: any) => {
      if (!ts) return 0;
      if (ts.toMillis) return ts.toMillis();
      if (ts._seconds) return ts._seconds * 1000;
      if (ts.getTime) return ts.getTime();
      return 0;
    };
    
    const aTime = getMs(a.updated_at) || getMs(a.submitted_at);
    const bTime = getMs(b.updated_at) || getMs(b.submitted_at);
    return bTime - aTime;
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Service Feedback
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {isEdit ? "Your submission for" : "Submit feedback for"}{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {formatTargetSunday(targetSunday)}
            </span>
          </p>
        </div>
      </div>

      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 rounded-lg border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-primary)" }}
      >
        <WeekPicker 
          value={targetSunday} 
          onChange={(val) => {
            setTargetSunday(val);
            fetchForWeek(val);
          }} 
        />
        
        {isReadOnly && (
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-primary)",
            }}
          >
            Read Only Access
          </span>
        )}
      </div>

      <div className="space-y-4">
        {!isReadOnly && isEdit && (
          <div
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background: "var(--success-subtle)",
              color: "var(--success)",
              border: "1px solid var(--success)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
            Already submitted — you can update it below
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            id="feedback-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isReadOnly || submitting || fetching}
            rows={6}
            maxLength={1000}
            placeholder={isReadOnly && !draft ? "No feedback submitted." : "Share your thoughts on this Sunday's service…"}
            className="w-full px-4 py-3 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 disabled:opacity-70"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />

          {!isReadOnly && (
            <div className="flex items-center justify-between">
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{draft.length}/1000</div>
              <button
                id="feedback-submit-btn"
                type="submit"
                disabled={submitting || !draft.trim() || fetching}
                className="px-5 py-2 text-sm font-medium text-white rounded-md transition-colors focus:outline-none focus:ring-2 disabled:opacity-70"
                style={{ background: "var(--accent)" }}
              >
                {submitting ? "Saving…" : isEdit ? "Update Feedback" : "Submit Feedback"}
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="space-y-4 pt-4" style={{ borderTop: "1px solid var(--border-primary)" }}>
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            All Submissions
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {sortedFeedback.length === 0
              ? "No submissions yet for this Sunday."
              : `${sortedFeedback.length} submission${sortedFeedback.length !== 1 ? "s" : ""} received`}
          </p>
        </div>

        {fetching ? (
          <div className="animate-pulse space-y-4">
             <div className="h-24 bg-black/5 rounded-lg" />
             <div className="h-24 bg-black/5 rounded-lg" />
          </div>
        ) : sortedFeedback.length === 0 ? (
          <div
            className="rounded-lg px-5 py-6 text-center border-dashed border-2"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border-primary)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No one has submitted feedback yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFeedback.map((entry) => {
              const name = usersMap[entry.user_id] ?? "Unknown";
              const ts = entry.updated_at ?? entry.submitted_at;
              const timeStr = ts?.toDate
                ? ts.toDate().toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : (ts as unknown as { _seconds?: number })?._seconds 
                  ? new Date((ts as unknown as { _seconds: number })._seconds * 1000).toLocaleString("en-GB", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                    })
                  : "";

              return (
                <div
                  key={entry.id}
                  className="rounded-lg px-4 py-3 space-y-2"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-primary)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={name} uid={entry.user_id} size="sm" />
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {name}
                      </span>
                    </div>
                    {timeStr && (
                      <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                        {timeStr}
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {entry.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
