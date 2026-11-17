import mongoose from "mongoose";

const playlistTrackSchema = new mongoose.Schema(
  {
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Track",
      required: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedAt: { type: Date, default: Date.now, required: true },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    visibility: {
      type: String,
      enum: ["private", "public", "collaborative"],
      default: "private",
      required: true,
      index: true,
    },
    tracks: { type: [playlistTrackSchema], default: [] },
  },
  { timestamps: true },
);

schema.index({ visibility: 1, createdAt: -1 });

export const Playlist = mongoose.model("Playlist", schema);
