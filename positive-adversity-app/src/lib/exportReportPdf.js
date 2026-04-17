import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../assets/logo-full.png";

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function formatTime(value) {
  if (!value) return "-";

  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
    const [hourString, minute] = value.split(":");
    const hour = Number(hourString);
    if (Number.isNaN(hour)) return value;

    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getImageFormatFromDataUrl(dataUrl) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/jpeg")) return "JPEG";
  if (dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "PNG";
}

async function imageToDataUrl(imageSrc) {
  const response = await fetch(imageSrc);
  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function uint8ToBase64(uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function getInternalTotal(entry) {
  const hours = Number(entry?.hours || 0);
  const internalRate = Number(entry?.internalRate || 0);

  if (entry?.internalTotal != null) {
    return Number(entry.internalTotal || 0);
  }

  return Number((hours * internalRate).toFixed(2));
}

export async function exportEntriesPdf({
  entries = [],
  selectedMonth = "all",
  visibleUserLabel = "All Users",
  dcfSupervisionAmount = 0,
}) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  let logoDataUrl = null;

  try {
    logoDataUrl = await imageToDataUrl(logo);
  } catch (error) {
    console.error("Failed to load logo for PDF:", error);
  }

  // HEADER (LEFT ONLY)
  if (logoDataUrl) {
    const imageFormat = getImageFormatFromDataUrl(logoDataUrl);
    doc.addImage(logoDataUrl, imageFormat, 10, 8, 22, 22);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Positive Adversity Youth Services Inc.", 36, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Allan@PositiveAdversity.org", 36, 20);
  doc.text("www.positiveadversity.org", 36, 26);
  doc.text("(860) 625-6656", 36, 32);

  doc.setDrawColor(220, 220, 220);
  doc.line(10, 40, pageWidth - 10, 40);

  const totals = entries.reduce(
    (acc, entry) => {
      const hours = Number(entry?.hours || 0);
      const internalTotal = getInternalTotal(entry);

      acc.entries += 1;
      acc.hours += hours;
      acc.internalTotal += internalTotal;

      return acc;
    },
    { entries: 0, hours: 0, internalTotal: 0 }
  );

  const finalInternalTotal =
    totals.internalTotal + Number(dcfSupervisionAmount || 0);

  autoTable(doc, {
    startY: 46,
    showHead: "firstPage",
    head: [[
      "Student",
      "Service",
      "Date",
      "Time",
      "Hours",
      "Internal Rate",
      "Internal Total",
    ]],
    body: entries.flatMap((entry) => {
      const mainRow = [
        entry?.student || "-",
        entry?.serviceType || "-",
        entry?.date || formatDate(entry?.startTime),
        `${formatTime(entry?.startTime)} - ${formatTime(entry?.endTime)}`,
        Number(entry?.hours || 0).toFixed(2),
        formatCurrency(entry?.internalRate || 0),
        formatCurrency(getInternalTotal(entry)),
      ];

      const noteRow = [
        {
          content: `Note: ${entry?.note || "-"}`,
          colSpan: 7,
          styles: {
            textColor: [70, 70, 70],
            fillColor: [248, 250, 252],
          },
        },
      ];

      return [mainRow, noteRow];
    }),
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    theme: "grid",
    margin: { left: 10, right: 10 },
  });

  const finalY = doc.lastAutoTable?.finalY || 60;
  const pageHeight = doc.internal.pageSize.getHeight();
  let summaryY = finalY + 10;

  // NEW PAGE HEADER (ALSO LEFT ONLY)
  if (summaryY > pageHeight - 12) {
    doc.addPage();

    if (logoDataUrl) {
      const imageFormat = getImageFormatFromDataUrl(logoDataUrl);
      doc.addImage(logoDataUrl, imageFormat, 10, 8, 22, 22);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Positive Adversity Youth Services Inc.", 36, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Allan@PositiveAdversity.org", 36, 20);
    doc.text("www.positiveadversity.org", 36, 26);
    doc.text("(860) 625-6656", 36, 32);

    doc.setDrawColor(220, 220, 220);
    doc.line(10, 40, pageWidth - 10, 40);

    summaryY = 52;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);

  doc.text(`Entries: ${totals.entries}`, 10, summaryY);
  doc.text(`Hours: ${totals.hours.toFixed(2)}`, 70, summaryY);
  doc.text(`DCF Supervision: ${formatCurrency(dcfSupervisionAmount)}`, 130, summaryY);
  doc.text(`Internal Total: ${formatCurrency(finalInternalTotal)}`, 287, summaryY, { align: "right" });

  const fileName = `positive_adversity_report.pdf`;

  if (!Capacitor.isNativePlatform()) {
    doc.save(fileName);
    return;
  }

  const arrayBuffer = doc.output("arraybuffer");
  const base64Data = uint8ToBase64(new Uint8Array(arrayBuffer));

  const result = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Documents,
    recursive: true,
  });

  await Share.share({
    title: "Positive Adversity Report",
    text: "Positive Adversity PDF Report",
    url: result.uri,
  });
}