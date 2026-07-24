import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../assets/logo-full.png";
import { getEntryMonthKey } from "./entryMonth";

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

function getStudentLabel(entry) {
  return (entry?.student || "No student").trim() || "No student";
}

function getEntryDateValue(entry) {
  return entry?.date || entry?.startTime || "";
}

function sortEntriesByStudentAndDate(entries) {
  return [...entries].sort((a, b) => {
    const studentCompare = getStudentLabel(a).localeCompare(
      getStudentLabel(b),
      undefined,
      { sensitivity: "base" },
    );

    if (studentCompare !== 0) return studentCompare;

    return getEntryDateValue(a).localeCompare(getEntryDateValue(b));
  });
}

function groupEntriesByStudent(entries) {
  return sortEntriesByStudentAndDate(entries).reduce((groups, entry) => {
    const student = getStudentLabel(entry);
    const currentGroup = groups[groups.length - 1];

    if (!currentGroup || currentGroup.student !== student) {
      groups.push({ student, entries: [entry] });
    } else {
      currentGroup.entries.push(entry);
    }

    return groups;
  }, []);
}

function buildGroupedEntryRows(entries) {
  const sortedEntries = sortEntriesByStudentAndDate(entries);

  const rows = [];
  let currentStudent = "";
  let studentTotals = { hours: 0, internalTotal: 0 };

  const addStudentTotalRow = () => {
    if (!currentStudent) return;

    rows.push([
      {
        content: "Student Total",
        colSpan: 4,
        styles: {
          fillColor: [241, 245, 249],
          fontStyle: "bold",
          halign: "right",
          textColor: [15, 23, 42],
        },
      },
      {
        content: studentTotals.hours.toFixed(2),
        styles: {
          fillColor: [241, 245, 249],
          fontStyle: "bold",
          textColor: [15, 23, 42],
        },
      },
      {
        content: "",
        styles: {
          fillColor: [241, 245, 249],
        },
      },
      {
        content: formatCurrency(studentTotals.internalTotal),
        styles: {
          fillColor: [241, 245, 249],
          fontStyle: "bold",
          textColor: [15, 23, 42],
        },
      },
    ]);
  };

  sortedEntries.forEach((entry) => {
    const student = getStudentLabel(entry);

    if (student !== currentStudent) {
      addStudentTotalRow();
      currentStudent = student;
      studentTotals = { hours: 0, internalTotal: 0 };
      rows.push([
        {
          content: `Student: ${student}`,
          colSpan: 7,
          styles: {
            fillColor: [226, 232, 240],
            fontStyle: "bold",
            textColor: [15, 23, 42],
          },
        },
      ]);
    }

    const hours = Number(entry?.hours || 0);
    const internalTotal = getInternalTotal(entry);
    studentTotals.hours += hours;
    studentTotals.internalTotal += internalTotal;

    rows.push([
      student,
      entry?.serviceType || "-",
      entry?.date || formatDate(entry?.startTime),
      `${formatTime(entry?.startTime)} - ${formatTime(entry?.endTime)}`,
      hours.toFixed(2),
      formatCurrency(entry?.internalRate || 0),
      formatCurrency(internalTotal),
    ]);

    rows.push([
      {
        content: `Note: ${entry?.note || "-"}`,
        colSpan: 7,
        styles: {
          textColor: [70, 70, 70],
          fillColor: [248, 250, 252],
        },
      },
    ]);
  });

  addStudentTotalRow();

  return rows;
}

function drawReportHeader(doc, logoDataUrl) {
  const pageWidth = doc.internal.pageSize.getWidth();

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

  const rightX = pageWidth - 10;
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text("DBA: Positive Adversity Youth Services Inc.", rightX, 14, {
    align: "right",
  });
  doc.text("Allan V. Chaney, LLC", rightX, 20, { align: "right" });
  doc.text("43 Granada Terrace", rightX, 26, { align: "right" });
  doc.text("New London, CT 06320", rightX, 32, { align: "right" });

  doc.setDrawColor(220, 220, 220);
  doc.line(10, 40, pageWidth - 10, 40);
}

export async function exportEntriesPdf({
  entries = [],
  selectedMonth = "all",
  visibleUserLabel = "All Users",
  monthlyFees = [],
  dcfSupervisionAmount = 0,
}) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  let logoDataUrl = null;

  try {
    logoDataUrl = await imageToDataUrl(logo);
  } catch (error) {
    console.error("Failed to load logo for PDF:", error);
  }

  drawReportHeader(doc, logoDataUrl);

  const reportEntries =
    selectedMonth === "all"
      ? entries
      : entries.filter(
          (entry) => getEntryMonthKey(entry) === selectedMonth,
        );

  const totals = reportEntries.reduce(
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

  const appliedMonthlyFees = monthlyFees.length
    ? monthlyFees
    : Number(dcfSupervisionAmount || 0) > 0
    ? [
        {
          label: "Supervision Fee",
          amount: Number(dcfSupervisionAmount || 0),
        },
      ]
    : [];

  const monthlyFeeTotal = appliedMonthlyFees.reduce(
    (sum, fee) => sum + Number(fee?.amount || 0),
    0,
  );

  const finalInternalTotal = totals.internalTotal + monthlyFeeTotal;

  const studentGroups = groupEntriesByStudent(reportEntries);

  studentGroups.forEach((group, index) => {
    if (index > 0) {
      doc.addPage();
      drawReportHeader(doc, logoDataUrl);
    }

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
      body: buildGroupedEntryRows(group.entries),
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
  });

  const finalY = doc.lastAutoTable?.finalY || 60;
  const pageHeight = doc.internal.pageSize.getHeight();
  let summaryY = finalY + 10;

  // NEW PAGE HEADER (ALSO LEFT ONLY)
  if (summaryY > pageHeight - 12) {
    doc.addPage();

    drawReportHeader(doc, logoDataUrl);

    summaryY = 52;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);

  doc.text(`Entries: ${totals.entries}`, 10, summaryY);
  doc.text(`Hours: ${totals.hours.toFixed(2)}`, 70, summaryY);

  if (appliedMonthlyFees.length) {
    const feeSummary = appliedMonthlyFees
      .map((fee) => `${fee.label}: ${formatCurrency(fee.amount)}`)
      .join(" | ");

    doc.text(feeSummary, 130, summaryY, {
      maxWidth: doc.internal.pageSize.getWidth() - 205,
    });
  }

  doc.text(
    `Internal Total: ${formatCurrency(finalInternalTotal)}`,
    doc.internal.pageSize.getWidth() - 10,
    summaryY,
    { align: "right" }
  );

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
  directory: Directory.Cache,
  recursive: true,
});

  await Share.share({
    title: "Positive Adversity Report",
    text: "Positive Adversity PDF Report",
    url: result.uri,
  });
}
