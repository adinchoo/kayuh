const FOOD_DB = {
  "Main": [
    {name:"Nasi Kerabu", kcal:420, protein:18, carbs:55, fat:14, variants:true, sizes:{S:{kcal:300,protein:13},M:{kcal:420,protein:18},L:{kcal:580,protein:24}}},
    {name:"Nasi Lemak + Ayam", kcal:650, protein:28, carbs:70, fat:28, sizes:{S:{kcal:480,protein:20},M:{kcal:650,protein:28},L:{kcal:850,protein:35}}},
    {name:"Nasi Ayam Penyet", kcal:680, protein:35, carbs:65, fat:30},
    {name:"Nasi Goreng Kampung", kcal:520, protein:18, carbs:70, fat:18},
    {name:"Mee Goreng Mamak", kcal:600, protein:20, carbs:75, fat:25},
    {name:"Roti Canai (2pcs) + Dhal", kcal:400, protein:10, carbs:50, fat:18},
    {name:"Chicken Chop", kcal:550, protein:35, carbs:30, fat:28},
    {name:"Grilled Chicken Breast 200g", kcal:330, protein:62, carbs:0, fat:7},
    {name:"Ikan Siakap Bakar", kcal:280, protein:32, carbs:2, fat:16},
    {name:"Telur Goreng 2 biji", kcal:180, protein:12, carbs:1, fat:14}
  ],
  "Protein": [
    {name:"Whey Protein 1 scoop", kcal:120, protein:24, carbs:3, fat:1},
    {name:"Telur Rebus 2 biji", kcal:140, protein:12, carbs:1, fat:10},
    {name:"Ayam Dada 150g", kcal:250, protein:46, carbs:0, fat:5},
    {name:"Tuna Can", kcal:180, protein:30, carbs:0, fat:5},
    {name:"Greek Yogurt", kcal:100, protein:10, carbs:6, fat:0}
  ],
  "Drinks": [
    {name:"Teh Tarik", kcal:150, protein:2, carbs:18, fat:7},
    {name:"Kopi O", kcal:20, protein:0, carbs:4, fat:0},
    {name:"Milo Ais", kcal:200, protein:4, carbs:28, fat:8},
    {name:"Air Kosong", kcal:0, protein:0, carbs:0, fat:0},
    {name:"100 Plus", kcal:80, protein:0, carbs:20, fat:0}
  ],
  "Snacks": [
    {name:"Pisang", kcal:90, protein:1, carbs:23, fat:0},
    {name:"Kurma 3 biji", kcal:80, protein:0, carbs:20, fat:0},
    {name:"Kacang Badam 20g", kcal:120, protein:4, carbs:2, fat:10},
    {name:"Protein Bar", kcal:200, protein:20, carbs:15, fat:7}
  ]
};
const WORKOUT_TEMPLATES = {
  "Push Day": [{name:"Bench Press",sets:4,reps:8,weight:60},{name:"Overhead Press",sets:3,reps:10,weight:30},{name:"Incline DB Press",sets:3,reps:12,weight:22},{name:"Lateral Raise",sets:3,reps:15,weight:8},{name:"Triceps Pushdown",sets:3,reps:12,weight:25}],
  "Pull Day": [{name:"Deadlift",sets:4,reps:5,weight:80},{name:"Pull Up",sets:3,reps:8,weight:0},{name:"Barbell Row",sets:3,reps:10,weight:50},{name:"Face Pull",sets:3,reps:15,weight:20},{name:"Bicep Curl",sets:3,reps:12,weight:15}],
  "Leg Day": [{name:"Squat",sets:4,reps:8,weight:70},{name:"Romanian Deadlift",sets:3,reps:10,weight:60},{name:"Leg Press",sets:3,reps:12,weight:120},{name:"Leg Curl",sets:3,reps:12,weight:40},{name:"Calf Raise",sets:4,reps:15,weight:30}],
  "Full Body": [{name:"Squat",sets:3,reps:10,weight:60},{name:"Bench Press",sets:3,reps:10,weight:50},{name:"Row",sets:3,reps:10,weight:40},{name:"Plank",sets:3,reps:60,weight:0}],
  "Cycling": [{name:"Cycling Outdoor",sets:1,reps:60,weight:0}],
  "Running": [{name:"Running",sets:1,reps:30,weight:0}]
};
