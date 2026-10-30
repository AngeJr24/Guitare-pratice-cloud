import mongoose from "mongoose";

const audioSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    sourceTrackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Track",
      default: null,
    },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
      validate: {
        validator(value) {
          if (this.audio || this.media?.length) {
            return true;
          }
          return typeof value === "string" && value.trim().length > 0;
        },
        message: "Le texte de la publication doit contenir de 1 à 2000 caractères",
      },
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      required: true,
    },
    audio: { type: audioSchema, default: null },
    media: [
      {
        originalName: { type: String, required: true },
        storedName: { type: String, required: true, select: false },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true, min: 0 },
      },
    ],
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });

export const Post = mongoose.model("Post", schema);
