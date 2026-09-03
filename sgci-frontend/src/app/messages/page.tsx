'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRole, canGerer } from '@/lib/role';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Plus, Send, ArrowLeft, Users } from 'lucide-react';

interface ChatUser {
  id: number;
  name: string;
  role?: string;
}

interface ChatMessage {
  id: number;
  user_id: number;
  message: string;
  type: string;
  created_at: string;
  user?: { id: number; name: string };
}

interface Conversation {
  id: number;
  titre: string;
  type: string;
  statut: string;
  updated_at: string;
  participants?: ChatUser[];
  dernier_message?: ChatMessage | null;
  messages_non_lus?: number;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ChatUser[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [staff, setStaff] = useState<ChatUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const peutCreer = canGerer(user, getEffectiveRole(user));
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const chargerConversations = useCallback(async () => {
    try {
      const res = await apiFetch('/chat');
      if (res.ok) {
        const json = await res.json();
        setConversations(Array.isArray(json?.data) ? json.data : []);
      }
    } catch {
      // silencieux : le polling retentera
    }
  }, []);

  const chargerConversation = useCallback(async (id: number) => {
    try {
      const res = await apiFetch(`/chat/${id}`);
      if (res.ok) {
        const conv = await res.json();
        setMessages(Array.isArray(conv?.messages) ? conv.messages : []);
        setParticipants(Array.isArray(conv?.participants) ? conv.participants : []);
      }
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    chargerConversations();
    const t = setInterval(chargerConversations, 6000);
    return () => clearInterval(t);
  }, [chargerConversations]);

  useEffect(() => {
    if (activeId === null) return;
    chargerConversation(activeId);
    const t = setInterval(() => chargerConversation(activeId), 5000);
    return () => clearInterval(t);
  }, [activeId, chargerConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const envoyer = async () => {
    if (!activeId || !draft.trim() || sending) return;
    const contenu = draft.trim();
    setSending(true);
    try {
      const res = await apiFetch(`/chat/${activeId}/message`, {
        method: 'POST',
        body: JSON.stringify({ message: contenu }),
      });
      if (res.ok) {
        setDraft('');
        await chargerConversation(activeId);
        await chargerConversations();
      }
    } finally {
      setSending(false);
    }
  };

  const ouvrirNouvelleDiscussion = async () => {
    setShowNewDialog(true);
    setSelectedIds([]);
    try {
      const res = await apiFetch('/users');
      if (res.ok) {
        const json = await res.json();
        const liste: ChatUser[] = Array.isArray(json) ? json : (json?.data ?? []);
        setStaff(liste.filter((u) => u.id !== user?.id));
      }
    } catch {
      setStaff([]);
    }
  };

  const creerDiscussion = async () => {
    if (selectedIds.length === 0) return;
    const autres = selectedIds.map((id) => staff.find((s) => s.id === id)?.name ?? '').filter(Boolean);
    const titre =
      autres.length === 1 ? autres[0] : `Groupe (${autres.length + 1} membres)`;

    const res = await apiFetch('/chat', {
      method: 'POST',
      body: JSON.stringify({
        titre,
        type: autres.length === 1 ? 'prive' : 'groupe',
        participant_ids: selectedIds,
      }),
    });

    if (res.ok) {
      setShowNewDialog(false);
      await chargerConversations();
      const json = await res.json();
      if (json?.data?.id) setActiveId(json.data.id);
    }
  };

  const initiale = (nom?: string) => (nom ?? '?').charAt(0).toUpperCase();

  const AVATAR_GRADIENTS = [
    'from-rose-500 to-pink-500',
    'from-orange-500 to-amber-500',
    'from-emerald-500 to-teal-500',
    'from-sky-500 to-indigo-500',
    'from-violet-500 to-purple-500',
    'from-fuchsia-500 to-pink-500',
  ];
  const gradientPour = (id?: number) =>
    AVATAR_GRADIENTS[((id ?? 0) % AVATAR_GRADIENTS.length + AVATAR_GRADIENTS.length) % AVATAR_GRADIENTS.length];
  const gradientPourNom = (nom?: string) => {
    const sum = (nom ?? '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return AVATAR_GRADIENTS[((sum % AVATAR_GRADIENTS.length) + AVATAR_GRADIENTS.length) % AVATAR_GRADIENTS.length];
  };

  const relativeDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    const diff = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round(diff / 86400000);
    if (days === 0) return 'Aujourd\'hui';
    if (days === 1) return 'Hier';
    if (days < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const separerParJour = (msgs: ChatMessage[]) => {
    const groupes: Array<{ cle: string; libelle: string; messages: ChatMessage[] }> = [];
    for (const m of msgs) {
      const d = new Date(m.created_at);
      const cle = d.toDateString();
      const derniere = groupes[groupes.length - 1];
      if (derniere && derniere.cle === cle) {
        derniere.messages.push(m);
      } else {
        groupes.push({ cle, libelle: relativeDate(m.created_at), messages: [m] });
      }
    }
    return groupes;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Discussions internes de votre boutique
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        {/* Liste des conversations */}
        <div className="border border-border rounded-2xl bg-card/60 overflow-hidden flex flex-col h-[70vh]">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Discussions</span>
            {peutCreer && (
              <Button size="sm" variant="secondary" onClick={ouvrirNouvelleDiscussion}>
                <Plus className="w-4 h-4 mr-1" /> Nouvelle
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Aucune discussion pour le moment.
              </p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left p-3 flex items-center gap-3 border-b border-border/50 transition-colors hover:bg-muted/50 ${
                  c.id === activeId ? 'bg-orange-500/10' : ''
                }`}
              >
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradientPourNom(c.titre)} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm`}>
                  {c.type === 'groupe' ? <Users className="w-4 h-4" /> : initiale(c.titre)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.titre}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.dernier_message?.message ?? '—'}
                  </p>
                </div>
                {(c.messages_non_lus ?? 0) > 0 && (
                  <Badge className="bg-orange-500 hover:bg-orange-500 shrink-0">
                    {c.messages_non_lus}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fil de discussion */}
        <div className="border border-border rounded-2xl bg-card/60 flex flex-col h-[70vh] overflow-hidden">
          {activeConversation === null ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Sélectionnez une discussion
            </div>
          ) : (
            <>
              <div className="md:hidden p-3 border-b border-border">
                <Button size="sm" variant="ghost" onClick={() => setActiveId(null)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                </Button>
              </div>
              <div className="p-3 border-b border-border">
                <p className="font-medium text-sm">{activeConversation.titre}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {participants.map((p) => p.name).join(', ')}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mb-3">
                      <MessageCircle className="w-6 h-6" />
                    </div>
                    <p className="text-sm">Aucun message pour le moment.</p>
                    <p className="text-xs text-muted-foreground/70">Écrivez le premier message de cette discussion.</p>
                  </div>
                ) : (
                  separerParJour(messages).map((groupe) => (
                    <div key={groupe.cle} className="space-y-3">
                      <div className="flex items-center justify-center gap-3">
                        <span className="h-px flex-1 bg-border/70" />
                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground capitalize">
                          {groupe.libelle}
                        </span>
                        <span className="h-px flex-1 bg-border/70" />
                      </div>
                      {groupe.messages.map((m) => {
                        const mine = m.user_id === user?.id;
                        if (m.type === 'systeme') {
                          return (
                            <p key={m.id} className="text-center text-xs text-muted-foreground py-1">
                              {m.message}
                            </p>
                          );
                        }
                        const estGroupe = groupe.messages.some(
                          (x) => x !== m && x.user_id === m.user_id
                        );
                        return (
                          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                            {!mine && (
                              <div
                                className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradientPour(m.user_id)} flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${
                                  estGroupe ? 'opacity-0' : ''
                                }`}
                              >
                                {initiale(m.user?.name)}
                              </div>
                            )}
                            <div
                              className={`relative max-w-[75%] px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm ${
                                mine
                                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl rounded-br-md'
                                  : 'bg-muted text-foreground rounded-2xl rounded-bl-md'
                              }`}
                            >
                              {!mine && (
                                <p className="text-xs font-semibold mb-0.5 text-orange-600 dark:text-orange-400">
                                  {m.user?.name ?? 'Membre'}
                                </p>
                              )}
                              <p>{m.message}</p>
                              <p className={`mt-1 text-[10px] leading-none ${mine ? 'text-white/70' : 'text-muted-foreground'}`}>
                                {new Date(m.created_at).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            {mine && (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm">
                                {initiale(user?.name)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t border-border flex items-center gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      envoyer();
                    }
                  }}
                  placeholder="Écrire un message…"
                  disabled={sending}
                />
                <Button onClick={envoyer} disabled={sending || !draft.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialogue nouvelle discussion */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4">
            <div>
              <h2 className="font-bold">Nouvelle discussion</h2>
              <p className="text-sm text-muted-foreground">
                Choisissez les membres de votre équipe.
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {staff.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun autre membre trouvé.</p>
              )}
              {staff.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(s.id)}
                    onChange={(e) =>
                      setSelectedIds((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)
                      )
                    }
                    className="accent-orange-500"
                  />
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradientPourNom(s.name)} flex items-center justify-center text-white text-xs font-bold`}>
                    {initiale(s.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{s.role}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowNewDialog(false)}>
                Annuler
              </Button>
              <Button onClick={creerDiscussion} disabled={selectedIds.length === 0}>
                Créer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
