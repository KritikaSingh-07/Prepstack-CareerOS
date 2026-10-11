import mongoose from 'mongoose';

const { Schema } = mongoose;

export const experienceSchema = new Schema({
  title: String,
  organization: String,
  startDate: String,
  endDate: String,
  bullets: [String],
  technologies: [String],
});

export const projectSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  bullets: [String],
  technologies: [String],
  url: String,
});

export const educationSchema = new Schema({
  degree: String,
  institution: String,
  startDate: String,
  endDate: String,
  score: String,
});
