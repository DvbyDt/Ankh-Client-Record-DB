import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {

    const requestBody = await request.json();
    console.log('Incoming request payload:', requestBody);

    const { 
        lessonType, 
        instructorId, 
        location, 
        customers 
    } = requestBody;

    if (!lessonType || !instructorId || !location || !customers) {
        return NextResponse.json(
            { error: 'Missing required lesson fields: lessonType, instructorId, locationId, and customers.' },
            { status: 400 }
        );
    }

    try {
        // Create the lesson
        const newLesson = await prisma.lesson.create({
            data: {
                lessonType: lessonType,
                instructor: {
                    connect: { id: instructorId } 
                },
                location: {
                    connect: { id: location }
                }
            },
            select: {
                id: true,
                lessonType: true,
                createdAt: true,
                instructorId: true,
                locationId: true
            },
        });

        // Process customers array
        for (const customerData of customers) {
            const customer = await prisma.customer.upsert({
                where: { email: customerData.email },
                update: {},
                create: {
                    email: customerData.email,
                    firstName: customerData.firstName,
                    lastName: customerData.lastName,
                    phone: customerData.phone || null
                }
            });

            // Create lesson participant entry
            await prisma.lessonParticipant.create({
                data: {
                    lessonId: newLesson.id,
                    customerId: customer.id,
                    status: "attended", // Default status, can be customized,
                    customerSymptoms: customerData?.symptoms,
                    customerImprovements: customerData?.improvements
                }
            });
        }

        return NextResponse.json({ lesson: newLesson }, { status: 201 });
    }
    catch (error) {
        console.error('Error creating lesson:', error);

        if (error instanceof Error && error.message.includes('Foreign key constraint failed')) {
            return NextResponse.json(
                { error: 'Invalid instructorId or locationId provided.' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Internal server error while creating lesson' },
            { status: 500 }
        );
    }
}