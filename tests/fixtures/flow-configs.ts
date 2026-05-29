export type PaymentMethod = "new-card" | "saved-card" | "auto";

export interface FlowConfig {
  name: string;
  conditionJourneyType: "nhs" | "private";
  conditionName: string;
  booking: {
    appointmentType: "Video" | "Face to Face" | "Phone call";
    useNextAvailableSlot: boolean;
    preferredMonth?: string;
    preferredDate?: string;
    preferredTime?: string;
    autoMoveToNextDate: boolean;
    maxDateAttempts: number;
  };
  paymentMethod: PaymentMethod;
}

export const FLOW_CONFIGS: FlowConfig[] = [
  {
    name: "NHS — next available slot",
    conditionJourneyType: "nhs",
    conditionName: "shingles",
    booking: {
      appointmentType: "Video",
      useNextAvailableSlot: true,
      autoMoveToNextDate: true,
      maxDateAttempts: 10,
    },
    paymentMethod: "auto",
  },
  {
    name: "NHS — specific date and time",
    conditionJourneyType: "nhs",
    conditionName: "shingles",
    booking: {
      appointmentType: "Video",
      useNextAvailableSlot: false,
      preferredMonth: "May 2026",
      preferredDate: "9 May",
      preferredTime: "07:00 AM",
      autoMoveToNextDate: true,
      maxDateAttempts: 10,
    },
    paymentMethod: "auto",
  },
  {
    name: "Private — next available slot, new card",
    conditionJourneyType: "private",
    conditionName: "weight management",
    booking: {
      appointmentType: "Video",
      useNextAvailableSlot: true,
      autoMoveToNextDate: true,
      maxDateAttempts: 10,
    },
    paymentMethod: "new-card",
  },
  {
    name: "Private — next available slot, saved card",
    conditionJourneyType: "private",
    conditionName: "weight management",
    booking: {
      appointmentType: "Video",
      useNextAvailableSlot: true,
      autoMoveToNextDate: true,
      maxDateAttempts: 10,
    },
    paymentMethod: "saved-card",
  },
  {
    name: "Private — specific date, new card",
    conditionJourneyType: "private",
    conditionName: "weight management",
    booking: {
      appointmentType: "Video",
      useNextAvailableSlot: false,
      preferredMonth: "May 2026",
      preferredDate: "9 May",
      preferredTime: "07:00 AM",
      autoMoveToNextDate: true,
      maxDateAttempts: 10,
    },
    paymentMethod: "new-card",
  },
  {
    name: "Private — specific date, saved card",
    conditionJourneyType: "private",
    conditionName: "weight management",
    booking: {
      appointmentType: "Video",
      useNextAvailableSlot: false,
      preferredMonth: "May 2026",
      preferredDate: "9 May",
      preferredTime: "07:00 AM",
      autoMoveToNextDate: true,
      maxDateAttempts: 10,
    },
    paymentMethod: "saved-card",
  },
];
