import mongoose from "mongoose";

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
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
      required: true,
    },
  },
  { timestamps: true },
);

schema.index({ createdAt: -1 });

export const Post = mongoose.model("Post", schema);
