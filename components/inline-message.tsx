export default function InlineMessage({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error" | "success" | "info";
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-[#cde4d1] bg-[#f0f8f1] text-[#39714c]",
    info: "border-[#d6e6e0] bg-[#f3f8f5] text-[#57796a]",
  };
  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${styles[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </p>
  );
}
