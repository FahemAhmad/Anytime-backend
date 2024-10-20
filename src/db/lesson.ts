import mongoose from "mongoose";

const TimeSlotsSchema = new mongoose.Schema({
  morning: [String],
  afternoon: [String],
  evening: [String],
});

const SelectedDaySchema = new mongoose.Schema({
  day: String,
  timeSlots: TimeSlotsSchema,
});

const AvailableTimeSchema = new mongoose.Schema({
  selectedDays: [SelectedDaySchema],
});

const LessonSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    topic: { type: String, required: true },
    price: { type: Number, required: true, min: 1, max: 10000 },
    description: { type: String, required: true, min: 10, max: 500 },
    range: {
      startDate: {
        type: String,
        required: true,
      },
      endDate: {
        type: String,
        required: true,
      },
    },
    tutor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    availability: {
      type: AvailableTimeSchema,
      required: false,
      default: {
        selectedDays: [SelectedDaySchema],
      },
    },
    booked: [
      {
        day: String,
        time: String,
      },
    ],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

LessonSchema.index({ tutor: 1 });

export const LessonModel = mongoose.model("Lesson", LessonSchema);

export const createNewLessonDb = (values: Record<string, any>) => {
  return new LessonModel(values).save();
};

export const getOfferedLessonsDb = (userId: string) => {
  return LessonModel.find({ tutor: userId, active: true });
};

export const deleteLessonByIdDb = (lessonId: string) => {
  return LessonModel.findByIdAndUpdate(
    lessonId,
    { active: false },
    { new: true }
  );
};

export const getLessonDetailsByIdDb = (lessonId: string) => {
  return LessonModel.findById(lessonId);
};
