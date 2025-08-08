const asyncHandler = require("express-async-handler");
const express = require("express");
const Event = require("../models/events.model.js");
const Pass = require("../models/passes.model.js");
const User = require("../models/users.model.js");
const mongoose = require("mongoose");
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const qs = require('qs');



const bookTicket = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { eventId } = req.body;
    const userId = req.user?.userId;

    if (!userId || !eventId) {
      return res.status(400).json({ success: false, error: "User ID and Event ID are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid ID format" });
    }

    session.startTransaction();

    const updatedEvent = await Event.findOneAndUpdate(
      {
        _id: eventId,
        $expr: { $gt: ["$totalSeats", "$registrationCount"] }
      },
      { $inc: { registrationCount: 1 } },
      { new: true, session, projection: "_id name totalSeats registrationCount startTime location mode" }
    ).lean();

    if (!updatedEvent) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        error: "No tickets available - event is fully booked",
        availableSeats: 0
      });
    }

    let pass;
    try {
      pass = await Pass.create([{
        userId: new mongoose.Types.ObjectId(userId),
        eventId: new mongoose.Types.ObjectId(eventId),
        passStatus: "active",
        isScanned: false,
        timeScanned: null,
        createdAt: new Date(),
      }], { session });
    } catch (err) {
      if (err.code === 11000) { 
        await Event.findByIdAndUpdate(
          eventId,
          { $inc: { registrationCount: -1 } },
          { session }
        );
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          error: "You already have an active ticket for this event"
        });
      }
      throw err;
    }

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: "Ticket booked successfully",
      data: {
        passId: pass[0]._id,
        eventId: updatedEvent._id,
        eventName: updatedEvent.name,
        eventStartTime: updatedEvent.startTime,
        eventLocation: updatedEvent.location,
        eventMode: updatedEvent.mode,
        passStatus: pass[0].passStatus,
        createdAt: pass[0].createdAt,
        remainingSeats: updatedEvent.totalSeats - updatedEvent.registrationCount
      }
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Ticket booking error:', error);
    res.status(500).json({
      success: false,
      error: "Failed to book ticket. Please try again."
    });
  } finally {
    await session.endSession();
  }
};

const getPassByUUID = async (req, res) => {
  try {
    const passUUID = req.params.passUUID;
    if (!passUUID) {
      return res.status(400).json({ error: "Pass UUID is required" });
    }

    const pass = await Pass.findOne({ passUUID: passUUID })
      .populate('userId', 'name')
      .populate('eventId', 'name startDate')
      .select('eventId userId paymentStatus createdAt amount friends passUUID passType');

    if (!pass) {
      return res.status(404).json({ error: "Pass not found" });
    }

    const totalAmount = pass.amount

    const responseData = {
      passAmount: totalAmount,
      passEventName: pass.eventId?.name || "Unknown Event",
      passEventDate: pass.eventId?.startDate || "Unknown Date",
      passPaymentStatus: pass.paymentStatus || "ERROR",
      passCreatedAt: pass.createdAt || "NO",
      passStatus: pass.paymentStatus || "ERROR",
      passEnteries: pass.friends.length + 1, // Including the main userP
      eventId: pass.eventId?._id || "Unknown Event ID",
      // Additional fields that might be useful
    };

    return res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Get pass by UUID error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getPassByUserAndEvent = async (req, res) => {
  try {
     const { eventId } = req.body;
    const userId = req.user?.userId;

    if (!userId || !eventId) {
      return res.status(400).json({
        success: false,
        error: "User ID and Event ID are required"
      });
    }
    console.log("Fetching passes for user:", userId, "and event:", eventId);
    const pass = await Pass.findOne({
      userId: userId,
      eventId: eventId,
    })
    console.log("Found passes:", pass);
    if (!pass|| pass.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: "No passes found for this user and event" 
      });
    }

    // // Map through all passes to create the response array
    // const passesData = passes.map(pass => {
    //   return {
    //     passId: pass._id,
    //     userId: pass.userId,
    //     eventId: pass.eventId._id,
    //     eventName: pass.eventId.name,
    //     eventStartTime: pass.eventId.startTime,
    //     eventLocation: pass.eventId.location,
    //     eventMode: pass.eventId.mode,
    //     passStatus: pass.passStatus,
    //     isScanned: pass.isScanned,
    //     timeScanned: pass.timeScanned,
    //     createdAt: pass.createdAt,
    //     userEmail: req.user.email
    //   };
    // });

    // console.log("Passes found:", passesData.length);

    return res.status(200).json({
      success: true,
      message: "Passes found successfully",
      pass,
    });
  } catch (error) {
    console.error('Get passes error:', error);
    return res.status(500).json({ 
      success: false,
      error: "Internal server error",
      message: error.message 
    });
  }
};
const getPassByQrStringsAndPassUUID = async (req, res) => {
  console.log(req.body.passUUID)
  try {
    const pass = await Pass.findById(req.body.passUUID).populate("userId").populate("eventId");

    // console.log(req.body.qrId)
    console.log(pass)

    if (!pass) {
      return res.status(404).json({ error: "Valid pass not found" });
    }

    let person = null;

    // Check if qrStrings exists and is an array
    // if (pass.qrStrings && Array.isArray(pass.qrStrings)) {
    //   // Use for...of loop to iterate over the actual objects
    //   for (const qr of pass.qrStrings) {
    //     if (qr._id && qr._id.toString() === req.body.qrId) {
    //       console.log("QR found", qr)
    //       person = qr;
    //       break;
    //     }
    //   }
    // }

    console.log("Found person:", person)

    return res.status(200).json({
      success: true,
      data: {
        buyer: pass.userId.name,
        buyerIMG: pass.userId.image,
        event: pass.eventId.name,
        passStatus: pass.passStatus,
        isScanned: pass.isScanned,
        timeScanned: pass.timeScanned,
      },
    });

  } catch (error) {
    console.error('Get pass by UUID error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
const Accept = async (req, res) => {
  try {
    let passUUID = req.body.passUUID;
    console.log(passUUID)
    if (!passUUID) {
      return res.status(400).json({ error: "Pass UUID is required" });
    }
    // let qrId = req.body.qrId;
    // if (!qrId) {
    //   return res.status(400).json({ error: "QR ID is required" });
    // }

    // Find pass by passUUID field, not by _id
    const pass = await Pass.findById(passUUID);
    if (!pass) {
      return res.status(404).json({ error: "Pass not found" });
    }

    console.log(pass);

    // Find the QR string by _id
    // const qrString = pass.qrStrings.find(qr => qr._id.toString() === qrId);
    // if (!qrString) {
    //   return res.status(404).json({ error: "QR code not found" });
    // }

    // if (qrString.isScanned) {
    //   return res.status(400).json({ error: "QR code already scanned" });
    // }

    pass.timeScanned = new Date();
    pass.isScanned = true;
    await pass.save();
    return res.status(200).json({ message: "Pass scanned successfully" });
  }
  catch (error) {
    console.error('Accept pass error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// const Reject = async (req, res) => {
//   try{
//   let passUUID= req.params.uuid;
//   if (!passUUID) {
//     return res.status(400).json({ error: "Pass UUID is required" });
//   }
//   qrId = req.params.qrId;
//   if (!qrId) {
//     return res.status(400).json({ error: "QR ID is required" });
//   }
//     const pass = await Pass.findById(uuid);
//     if (!pass) {
//       return res.status(404).json({ error: "Pass not found" });
//     }
//     const qrString = pass.qrStrings.find(qr => qr.id === qrId);
//     if (!qrString) {
//       return res.status(404).json({ error: "QR code not found" });
//     }
//     if (qrString.isScanned) {
//       return res.status(400).json({ error: "QR code already scanned" });
//     }
//     qrString.isScanned = ;
//     qrString.scannedAt = new Date();
//     await pass.save();
//     return res.status(200).json({ message: "Pass scanned successfully" });
//   }
//   catch (error) {
//     console.error('Accept pass error:', error);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// };



const canScan = async (req, res) => {
  let user = req.user;
  // let eventId = req.body.eventId;
  // const event = await Event.findById(eventId);
  if (user.role !== 'admin' && user.role !== 'event_manager') {
    return res.status(403).json({ error: "Forbidden: Invalid role" });
  }
  try {
    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden: Invalid role" });
    }
    return res.status(200).json({ message: "User can scan passes" });

  }
  catch (error) {
    console.error('Get pass error:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  getPassByUserAndEvent,
  bookTicket,
  canScan,
  Accept,
  getPassByQrStringsAndPassUUID,
  getPassByUUID,
};