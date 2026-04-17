import { NextRequest, NextResponse } from "next/server"
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {

    const requestBody = await request.json();
    console.log('Incoming request payload:', requestBody);

    const {
        lessonType,
        lessonDate,
        lessonContent,
        instructorId,
        instructorIds,
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
        const parsedLessonDate = lessonDate ? new Date(lessonDate) : null
        const lessonCreatedAt = parsedLessonDate && !Number.isNaN(parsedLessonDate.getTime())
            ? parsedLessonDate
            : undefined

        const newLesson = await prisma.lesson.create({
            data: {
                lessonType: lessonType,
                lessonContent: lessonContent || null,
                ...(lessonCreatedAt ? { createdAt: lessonCreatedAt } : {}),
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

        // Create additional instructor assignments if instructorIds array provided
        if (Array.isArray(instructorIds) && instructorIds.length > 0) {
            const additionalIds = instructorIds.filter(
                (id: string) => id && id !== instructorId
            )
            if (additionalIds.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (prisma as any).lessonInstructor.createMany({
                    data: additionalIds.map((userId: string) => ({
                        lessonId: newLesson.id,
                        userId
                    })),
                    skipDuplicates: true
                })
            }
        }

        // Process customers array
        for (const customerData of customers) {
            // If email provided, upsert by email. Otherwise find by phone or create fresh.
            let customer
            if (customerData.email && customerData.email.trim()) {
                customer = await prisma.customer.upsert({
                    where: { email: customerData.email },
                    update: {},
                    create: {
                        email: customerData.email,
                        firstName: customerData.firstName,
                        lastName: customerData.lastName,
                        phone: customerData.phone || null,
                        company: customerData.company || null
                    }
                })
            } else if (customerData.id) {
                // Existing customer passed by ID (existing customer flow)
                const found = await prisma.customer.findUnique({ where: { id: customerData.id } })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                customer = found ?? await (prisma.customer.create as any)({
                    data: {
                        firstName: customerData.firstName,
                        lastName: customerData.lastName,
                        phone: customerData.phone || null,
                        company: customerData.company || null
                    }
                })
            } else {
                // New customer, no email — create without email
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                customer = await (prisma.customer.create as any)({
                    data: {
                        firstName: customerData.firstName,
                        lastName: customerData.lastName,
                        phone: customerData.phone || null,
                        company: customerData.company || null
                    }
                })
            }

            // Create lesson participant entry
            await prisma.lessonParticipant.create({
                data: {
                    lessonId: newLesson.id,
                    customerId: customer.id,
                    status: customerData?.feedback || "attended",
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
