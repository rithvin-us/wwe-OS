import { ApiRequestError } from "@bop/sdk";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/components/animated-pressable";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { askAssistant } from "@/lib/ai";

interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
}

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `m${nextId}`;
}

export default function AssistantScreen() {
  const theme = useTheme();
  const listRef = useRef<FlatList<Message>>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      role: "assistant",
      text: "Hi — I can help with general questions about running the company on WWE OS. I don't have access to your live records, so I can't look up specific invoices or employees, but I can point you to the right place.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const userMessage: Message = { id: makeId(), role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);
    try {
      const result = await askAssistant(text);
      setMessages((prev) => [...prev, { id: makeId(), role: "assistant", text: result.text }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "error",
          text: err instanceof ApiRequestError ? err.message : "Couldn't reach the assistant.",
        },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }

  return (
    <ThemedView style={styles.container} animated>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Assistant
          </ThemedText>
        </View>

        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.role === "user"
                    ? [styles.bubbleUser, { backgroundColor: theme.primary }]
                    : item.role === "error"
                      ? [
                          styles.bubbleAssistant,
                          {
                            backgroundColor: `${theme.destructive}18`,
                            borderColor: theme.destructive,
                          },
                        ]
                      : [
                          styles.bubbleAssistant,
                          { backgroundColor: theme.card, borderColor: theme.border },
                        ],
                ]}
              >
                <ThemedText
                  style={
                    item.role === "user"
                      ? { color: theme.primaryForeground }
                      : item.role === "error"
                        ? { color: theme.destructive }
                        : undefined
                  }
                >
                  {item.text}
                </ThemedText>
              </View>
            )}
          />
          {sending ? (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={theme.mutedForeground} />
              <ThemedText type="small" themeColor="mutedForeground">
                Thinking…
              </ThemedText>
            </View>
          ) : null}

          <View
            style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask something…"
              placeholderTextColor={theme.mutedForeground}
              multiline
              style={[styles.input, { color: theme.foreground }]}
              onSubmitEditing={handleSend}
            />
            <AnimatedPressable
              onPress={handleSend}
              disabled={!input.trim() || sending}
              style={[
                styles.sendButton,
                { backgroundColor: theme.primary, opacity: !input.trim() || sending ? 0.5 : 1 },
              ]}
            >
              <ThemedText style={{ color: theme.primaryForeground, fontWeight: "600" }}>
                Send
              </ThemedText>
            </AnimatedPressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  bubble: {
    maxWidth: "85%",
    padding: Spacing.three,
    borderRadius: 14,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.two,
    padding: Spacing.two,
    margin: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    fontSize: 15,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  sendButton: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
