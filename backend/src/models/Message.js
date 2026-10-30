import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

schema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
schema.index({ recipientId: 1, senderId: 1, createdAt: -1 });

export const Message = mongoose.model("Message", schema);
